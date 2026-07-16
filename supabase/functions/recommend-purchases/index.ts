// "Completes your wardrobe": ranks real catalog products (affiliate feeds +
// organic imports) against the user's wardrobe and preferences. SQL prefilter
// keeps the LLM prompt small; results cached like outfits.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AiUnavailable, chatCompletion, extractJson } from '../_shared/featherless.ts';
import { checkAiBudget, recordAiUsage } from '../_shared/rateLimit.ts';
import { PurchaseRecsSchema, type PurchaseRecs } from '../_shared/types.ts';

const CACHE_DAYS = 3;
const MIN_WARDROBE_ITEMS = 3;
const CANDIDATE_LIMIT = 80;
const SUGGESTION_COUNT = 6;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
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

  const body = await req.json().catch(() => ({}));
  const regenerate = body?.regenerate === true;

  const { data: items } = await admin
    .from('items')
    .select('title, category, subcategory, colors, style_tags, brand')
    .eq('user_id', userId);
  if (!items || items.length < MIN_WARDROBE_ITEMS) {
    return jsonResponse({ error: 'not enough items', min_items: MIN_WARDROBE_ITEMS }, 422);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('locale, style_preferences, sex')
    .eq('id', userId)
    .single();

  // SQL prefilter: active products, gender-compatible, newest first.
  let query = admin
    .from('catalog_products')
    .select('id, title, brand, price, currency, category, url, affiliate_url, image_url, merchant, source, network')
    .eq('active', true)
    .order('last_seen_at', { ascending: false })
    .limit(CANDIDATE_LIMIT);
  if (profile?.sex === 'male') query = query.or('gender.is.null,gender.in.(male,unisex)');
  if (profile?.sex === 'female') query = query.or('gender.is.null,gender.in.(female,unisex)');
  const { data: candidates } = await query;
  if (!candidates || candidates.length < 3) {
    return jsonResponse({ error: 'catalog empty' }, 422);
  }

  const inputHash = await sha256(
    JSON.stringify({
      wardrobe: items.map((i) => [i.category, i.subcategory, i.colors, i.style_tags]),
      candidates: candidates.map((c) => c.id),
      preferences: profile?.style_preferences ?? '',
    }),
  );

  if (!regenerate) {
    const { data: cached } = await admin
      .from('recommendations')
      .select('payload')
      .eq('user_id', userId)
      .eq('kind', 'purchase')
      .eq('input_hash', inputHash)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) return jsonResponse({ ...(cached.payload as object), cached: true });
  }

  const budget = await checkAiBudget(admin, userId, 'purchase');
  if (!budget.ok) return jsonResponse({ error: budget.reason }, budget.status);

  const lang = (profile?.locale ?? 'ro') === 'ro' ? 'Romanian' : 'English';
  const prompt = [
    `You are a personal stylist. From the candidate products below, pick the ${SUGGESTION_COUNT} that best complete this user's wardrobe — fill gaps, match their colors and style. Avoid near-duplicates of what they already own.`,
    `Return ONLY JSON: {"suggestions":[{"catalog_product_id":"<id from candidates>","rationale":"one sentence in ${lang} explaining the match"}]}`,
    profile?.style_preferences ? `User preferences: ${profile.style_preferences}` : '',
    'Wardrobe summary (JSON):',
    JSON.stringify(items),
    'Candidate products (JSON):',
    JSON.stringify(
      candidates.map((c) => ({
        id: c.id,
        title: c.title,
        brand: c.brand,
        price: c.price,
        currency: c.currency,
        category: c.category,
      })),
    ),
  ]
    .filter(Boolean)
    .join('\n');

  try {
    let recs: PurchaseRecs | null = null;
    let totalPrompt = 0;
    let totalCompletion = 0;
    let model = '';
    const candidateIds = new Set(candidates.map((c) => c.id));
    for (let attempt = 0; attempt < 2 && !recs; attempt++) {
      const result = await chatCompletion(
        'text',
        [
          {
            role: 'user',
            content:
              attempt === 0
                ? prompt
                : prompt + '\nYour previous reply was invalid. Use only ids from the candidates list.',
          },
        ],
        { maxTokens: 700, temperature: 0.5 },
      );
      totalPrompt += result.promptTokens;
      totalCompletion += result.completionTokens;
      model = result.model;
      try {
        const parsed = PurchaseRecsSchema.parse(extractJson(result.content));
        recs = parsed.suggestions.every((s) => candidateIds.has(s.catalog_product_id))
          ? parsed
          : null;
      } catch {
        recs = null;
      }
    }

    await recordAiUsage(admin, {
      userId,
      endpoint: 'purchase',
      model,
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
    });

    if (!recs) return jsonResponse({ error: 'generation failed' }, 502);

    const productById = new Map(candidates.map((c) => [c.id, c]));
    const payload = {
      suggestions: recs.suggestions.map((s) => ({
        ...s,
        product: productById.get(s.catalog_product_id) ?? null,
      })),
    };

    await admin.from('recommendations').insert({
      user_id: userId,
      kind: 'purchase',
      input_hash: inputHash,
      payload,
      model,
      expires_at: new Date(Date.now() + CACHE_DAYS * 24 * 3600 * 1000).toISOString(),
    });

    return jsonResponse({ ...payload, cached: false });
  } catch (error) {
    if (error instanceof AiUnavailable) {
      return jsonResponse({ error: 'ai unavailable' }, 503);
    }
    throw error;
  }
});
