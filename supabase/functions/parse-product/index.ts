// Import pipeline for wishlist links. The client fetches the page HTML
// on-device (residential IP beats shop anti-bot) and POSTs {url, html};
// parsing lives here so it can be updated without an app release.
// Pipeline: structured data (JSON-LD/OG + store quirks) → LLM fallback.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'zod';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AiUnavailable, chatCompletion, extractJson } from '../_shared/featherless.ts';
import { detectStore, htmlForLlm, parsePrice, parseStructured } from '../_shared/parsers/index.ts';
import { checkAiBudget, recordAiUsage } from '../_shared/rateLimit.ts';
import { ParsedProductSchema, type ParsedProduct } from '../_shared/types.ts';

const BUCKET = 'item-photos';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  'Accept-Language': 'ro,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml',
};

const RequestSchema = z.object({
  url: z.url(),
  html: z.string().min(100).max(3_000_000).optional(),
});

const LlmExtractSchema = z.object({
  title: z.string().min(1),
  brand: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  image_url: z.string().nullable(),
  colors: z.array(z.string()).nullable(),
});

async function llmExtract(
  admin: SupabaseClient,
  userId: string,
  url: string,
  html: string,
): Promise<z.infer<typeof LlmExtractSchema> | null> {
  const budget = await checkAiBudget(admin, userId, 'extract');
  if (!budget.ok) return null;

  const prompt = [
    'Extract the clothing product from this online-shop page content. Return ONLY a JSON object with keys:',
    '"title" (product name, string), "brand" (string or null), "price" (number or null, the current price),',
    '"currency" (ISO code like RON/EUR or null), "image_url" (absolute URL of the main product photo or null),',
    '"colors" (array of color names in the page language, or null).',
    `Page URL: ${url}`,
    'Page content:',
    htmlForLlm(html),
  ].join('\n');

  try {
    let parsed: z.infer<typeof LlmExtractSchema> | null = null;
    let totalPrompt = 0;
    let totalCompletion = 0;
    let model = '';
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const result = await chatCompletion('text', [{ role: 'user', content: prompt }], {
        maxTokens: 400,
      });
      totalPrompt += result.promptTokens;
      totalCompletion += result.completionTokens;
      model = result.model;
      try {
        const raw = extractJson(result.content) as Record<string, unknown>;
        parsed = LlmExtractSchema.parse({ ...raw, price: parsePrice(raw.price) });
      } catch {
        parsed = null;
      }
    }
    await recordAiUsage(admin, {
      userId,
      endpoint: 'extract',
      model,
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
    });
    return parsed;
  } catch (error) {
    if (error instanceof AiUnavailable) return null;
    throw error;
  }
}

/** Downloads the shop image and re-hosts it in Storage (shop URLs rot). */
async function rehostImage(
  admin: SupabaseClient,
  userId: string,
  itemId: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { headers: BROWSER_HEADERS });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > 8_000_000) return null;
    const path = `${userId}/${itemId}/main.${ext}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'missing authorization' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (userError || !userData.user) return jsonResponse({ error: 'invalid token' }, 401);
  const userId = userData.user.id;

  const body = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonResponse({ error: 'invalid request' }, 400);
  const { url } = body.data;

  let html = body.data.html;
  if (!html) {
    // Server-side fallback fetch — works for lenient shops; bot-protected
    // ones need the client-supplied HTML.
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
      if (!res.ok) return jsonResponse({ error: 'could not fetch page' }, 422);
      html = await res.text();
    } catch {
      return jsonResponse({ error: 'could not fetch page' }, 422);
    }
  }

  // 1) structured data
  const outcome = parseStructured(url, html);
  let product: ParsedProduct | null = outcome.product;

  // 2) LLM fallback
  if (!product) {
    const llm = await llmExtract(admin, userId, url, html);
    if (llm) {
      product = ParsedProductSchema.parse({
        title: outcome.partial.title ?? llm.title,
        brand: outcome.partial.brand ?? llm.brand,
        image_url:
          outcome.partial.image_url ??
          (llm.image_url && /^https?:\/\//.test(llm.image_url) ? llm.image_url : null),
        price: outcome.partial.price ?? llm.price,
        currency: outcome.partial.currency ?? llm.currency,
        sizes_available: outcome.partial.sizes_available,
        in_stock: outcome.partial.in_stock,
        colors: llm.colors,
        canonical_url: null,
        external_id: outcome.partial.external_id,
        store: detectStore(url),
        parse_method: 'llm',
      });
    }
  }

  if (!product) return jsonResponse({ error: 'could not parse product' }, 422);

  // 3) item + tracked product + snapshot + wishlist collection
  const { data: item, error: itemError } = await admin
    .from('items')
    .insert({
      user_id: userId,
      status: 'wishlist',
      source: 'link',
      title: product.title,
      brand: product.brand,
      colors: product.colors ?? [],
    })
    .select()
    .single();
  if (itemError || !item) return jsonResponse({ error: 'could not save item' }, 500);

  const { data: tracked, error: trackedError } = await admin
    .from('tracked_products')
    .insert({
      item_id: item.id,
      user_id: userId,
      url,
      canonical_url: product.canonical_url,
      store: product.store,
      external_id: product.external_id,
      currency: product.currency,
      current_price: product.price,
      original_price: product.price,
      sizes_available: product.sizes_available,
      in_stock: product.in_stock,
      parse_method: product.parse_method,
      last_checked_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (trackedError || !tracked) {
    await admin.from('items').delete().eq('id', item.id);
    return jsonResponse({ error: 'could not save product' }, 500);
  }

  await admin.from('product_snapshots').insert({
    tracked_product_id: tracked.id,
    price: product.price,
    currency: product.currency,
    in_stock: product.in_stock,
    sizes_available: product.sizes_available,
  });

  const { data: wishlistCollection } = await admin
    .from('collections')
    .select('id')
    .eq('user_id', userId)
    .eq('is_system', true)
    .single();
  if (wishlistCollection) {
    await admin
      .from('collection_items')
      .insert({ collection_id: wishlistCollection.id, item_id: item.id });
  }

  // 4) re-host image (best effort)
  let finalItem = item;
  if (product.image_url) {
    const imagePath = await rehostImage(admin, userId, item.id, product.image_url);
    if (imagePath) {
      const { data: updated } = await admin
        .from('items')
        .update({ image_path: imagePath })
        .eq('id', item.id)
        .select()
        .single();
      if (updated) finalItem = updated;
    }
  }

  return jsonResponse({
    item: finalItem,
    tracked_product: tracked,
    parse_method: product.parse_method,
  });
});
