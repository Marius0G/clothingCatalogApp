// Vision auto-tagging: looks at an item photo and fills category, subcategory,
// colors and style tags. Tags are suggestions — the user can edit them in-app.
// Accepts either { item_id } (tags an existing item and updates it) or
// { image_base64, mime? } (tags a photo before the item exists — the add-item
// screen shows the suggestions as editable fields prior to saving).
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { isServiceRole } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AiUnavailable, chatCompletion, extractJson } from '../_shared/featherless.ts';
import { buildTagItemPrompt } from '../_shared/prompts.ts';
import { checkAiBudget, recordAiUsage } from '../_shared/rateLimit.ts';
import { ItemTagsSchema, type ItemTags } from '../_shared/types.ts';

// ~1200px JPEG at quality 0.85 stays well under this; anything bigger is abuse.
const MAX_BASE64_LENGTH = 6_000_000;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'missing authorization' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Service-role callers (backfill script) may tag any existing item; the
  // owning user is taken from the item row so budget/usage still attribute
  // to them. Normal callers must present a user JWT.
  const service = isServiceRole(req);
  let userId: string;
  if (service) {
    userId = ''; // resolved from the item row below
  } else {
    const { data: userData, error: userError } = await admin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !userData.user) return jsonResponse({ error: 'invalid token' }, 401);
    userId = userData.user.id;
  }

  const body = await req.json().catch(() => null);
  const itemId = typeof body?.item_id === 'string' ? body.item_id : null;
  const imageBase64 = typeof body?.image_base64 === 'string' ? body.image_base64 : null;
  if (!itemId && !imageBase64) {
    return jsonResponse({ error: 'item_id or image_base64 required' }, 400);
  }
  if (service && !itemId) {
    return jsonResponse({ error: 'service calls require item_id' }, 400);
  }

  let imageDataUrl: string;
  if (itemId) {
    const { data: item } = await admin.from('items').select('*').eq('id', itemId).single();
    if (!item || (!service && item.user_id !== userId)) {
      return jsonResponse({ error: 'item not found' }, 404);
    }
    if (service) userId = item.user_id;
    if (!item.image_path) return jsonResponse({ error: 'item has no image' }, 400);

    // Base64 data URL: works from any deployment (local signed URLs would be
    // unreachable from the AI provider) and never leaks a storage URL.
    const { data: blob, error: downloadError } = await admin.storage
      .from('item-photos')
      .download(item.image_path);
    if (downloadError || !blob) return jsonResponse({ error: 'could not read image' }, 500);
    const mime = item.image_path.endsWith('.png') ? 'image/png' : 'image/jpeg';
    imageDataUrl = `data:${mime};base64,${encodeBase64(await blob.arrayBuffer())}`;
  } else {
    if (imageBase64!.length > MAX_BASE64_LENGTH) {
      return jsonResponse({ error: 'image too large' }, 413);
    }
    const mime = body?.mime === 'image/png' ? 'image/png' : 'image/jpeg';
    imageDataUrl = `data:${mime};base64,${imageBase64}`;
  }

  const budget = await checkAiBudget(admin, userId, 'tag');
  if (!budget.ok) return jsonResponse({ error: budget.reason }, budget.status);

  const { data: profile } = await admin
    .from('profiles')
    .select('locale')
    .eq('id', userId)
    .single();

  try {
    let totalPrompt = 0;
    let totalCompletion = 0;
    let model = '';
    let tags: ItemTags | null = null;

    for (let attempt = 0; attempt < 2 && !tags; attempt++) {
      const result = await chatCompletion('vision', [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                attempt === 0
                  ? buildTagItemPrompt(profile?.locale ?? 'ro')
                  : buildTagItemPrompt(profile?.locale ?? 'ro') +
                    '\nYour previous reply was not valid JSON matching the schema. Return ONLY the JSON object.',
            },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
        // v2 extracts ~8 extra attribute fields; the default 512 can truncate.
      ], { maxTokens: 800 });
      totalPrompt += result.promptTokens;
      totalCompletion += result.completionTokens;
      model = result.model;
      try {
        tags = ItemTagsSchema.parse(extractJson(result.content));
      } catch {
        tags = null;
      }
    }

    await recordAiUsage(admin, {
      userId,
      endpoint: 'tag',
      model,
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
    });

    if (!tags) return jsonResponse({ error: 'tagging failed' }, 502);

    if (!itemId) return jsonResponse({ tags });

    // Fill-only-empty for the free-text fields: never overwrite what the user typed.
    const { data: current } = await admin
      .from('items')
      .select('title, brand, notes')
      .eq('id', itemId)
      .single();
    const { data: updated, error: updateError } = await admin
      .from('items')
      .update({
        title: current?.title || tags.title,
        brand: current?.brand || tags.brand,
        notes: current?.notes || tags.description,
        category: tags.category,
        subcategory: tags.subcategory,
        colors: tags.colors,
        style_tags: tags.style_tags,
        pattern: tags.pattern,
        material: tags.material,
        fit: tags.fit,
        formality: tags.formality,
        warmth: tags.warmth,
        seasons: tags.seasons,
        occasions: tags.occasions,
        layer: tags.layer,
        ai_tagged: true,
      })
      .eq('id', itemId)
      .select()
      .single();
    if (updateError) return jsonResponse({ error: 'update failed' }, 500);

    return jsonResponse({ item: updated, tags });
  } catch (error) {
    if (error instanceof AiUnavailable) {
      return jsonResponse({ error: 'ai unavailable' }, 503);
    }
    throw error;
  }
});
