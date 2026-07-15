// Vision auto-tagging: looks at an item photo and fills category, subcategory,
// colors and style tags. Tags are suggestions — the user can edit them in-app.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AiUnavailable, chatCompletion, extractJson } from '../_shared/featherless.ts';
import { checkAiBudget, recordAiUsage } from '../_shared/rateLimit.ts';
import { ItemTagsSchema, type ItemTags } from '../_shared/types.ts';

const STYLE_VOCAB =
  'casual, elegant, streetwear, sporty, formal, vintage, minimalist, boho, business, party, beach, cozy';

function prompt(locale: string): string {
  const lang = locale === 'ro' ? 'Romanian' : 'English';
  return [
    'You are a fashion cataloguing assistant. Look at the photo of a single clothing item and return ONLY a JSON object, no prose, with exactly these keys:',
    '- "category": one of "top","bottom","dress","outerwear","shoes","accessory" (always these exact English values)',
    `- "subcategory": the specific garment type (e.g. t-shirt, jeans, sneakers), in ${lang}, lowercase`,
    `- "colors": array of 1-4 dominant colors of the garment, simple color names in ${lang}, lowercase`,
    `- "style_tags": array of 2-6 style descriptors in ${lang}, lowercase, preferring: ${STYLE_VOCAB}`,
    'Ignore the background and any person wearing the item; describe the garment itself.',
  ].join('\n');
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

  const body = await req.json().catch(() => null);
  const itemId = body?.item_id;
  if (typeof itemId !== 'string') return jsonResponse({ error: 'item_id required' }, 400);

  const { data: item } = await admin.from('items').select('*').eq('id', itemId).single();
  if (!item || item.user_id !== userId) return jsonResponse({ error: 'item not found' }, 404);
  if (!item.image_path) return jsonResponse({ error: 'item has no image' }, 400);

  const budget = await checkAiBudget(admin, userId, 'tag');
  if (!budget.ok) return jsonResponse({ error: budget.reason }, budget.status);

  const { data: profile } = await admin
    .from('profiles')
    .select('locale')
    .eq('id', userId)
    .single();

  const { data: signed, error: signError } = await admin.storage
    .from('item-photos')
    .createSignedUrl(item.image_path, 120);
  if (signError || !signed) return jsonResponse({ error: 'could not read image' }, 500);

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
                  ? prompt(profile?.locale ?? 'ro')
                  : prompt(profile?.locale ?? 'ro') +
                    '\nYour previous reply was not valid JSON matching the schema. Return ONLY the JSON object.',
            },
            { type: 'image_url', image_url: { url: signed.signedUrl } },
          ],
        },
      ]);
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

    const { data: updated, error: updateError } = await admin
      .from('items')
      .update({
        category: tags.category,
        subcategory: tags.subcategory,
        colors: tags.colors,
        style_tags: tags.style_tags,
        ai_tagged: true,
      })
      .eq('id', itemId)
      .select()
      .single();
    if (updateError) return jsonResponse({ error: 'update failed' }, 500);

    return jsonResponse({ item: updated });
  } catch (error) {
    if (error instanceof AiUnavailable) {
      return jsonResponse({ error: 'ai unavailable' }, 503);
    }
    throw error;
  }
});
