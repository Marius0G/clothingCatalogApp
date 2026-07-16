// Outfit recommendations from the user's own wardrobe + wishlist.
// Cached in `recommendations` keyed by a hash of the wardrobe state and the
// style preferences, so repeat opens cost zero AI credits.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AiUnavailable, chatCompletion, extractJson } from '../_shared/featherless.ts';
import { checkAiBudget, recordAiUsage } from '../_shared/rateLimit.ts';
import { OutfitRecsSchema, type OutfitRecs } from '../_shared/types.ts';

const CACHE_DAYS = 7;
const MIN_ITEMS = 4;

type CompactItem = {
  id: string;
  title: string | null;
  category: string | null;
  subcategory: string | null;
  colors: string[];
  style_tags: string[];
  brand: string | null;
  status: string;
};

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildPrompt(locale: string, items: CompactItem[], preferences: string | null): string {
  const lang = locale === 'ro' ? 'Romanian' : 'English';
  return [
    'You are a personal stylist. Combine ONLY the wardrobe items below into 3 outfits.',
    'Rules:',
    '- Use only the provided "id" values; never invent ids.',
    '- Each outfit: 2-6 items, at most one "bottom", at most one "shoes", at most one "dress".',
    '- A "dress" outfit must not also contain a "top" and "bottom" pair.',
    '- Prefer color and style coherence; respect the user preferences if given.',
    `- "occasion" is a short outfit name and "rationale" one sentence explaining why it works, both in ${lang}.`,
    'Return ONLY a JSON object: {"outfits":[{"item_ids":["..."],"occasion":"...","rationale":"..."}]}',
    preferences ? `User preferences: ${preferences}` : '',
    'Wardrobe items (JSON):',
    JSON.stringify(items),
  ]
    .filter(Boolean)
    .join('\n');
}

function structurallyValid(recs: OutfitRecs, itemsById: Map<string, CompactItem>): boolean {
  for (const outfit of recs.outfits) {
    const items = outfit.item_ids.map((id) => itemsById.get(id));
    if (items.some((item) => !item)) return false;
    const count = (category: string) => items.filter((i) => i!.category === category).length;
    if (count('bottom') > 1 || count('shoes') > 1 || count('dress') > 1) return false;
    if (count('dress') === 1 && count('bottom') > 0) return false;
  }
  return true;
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

  const { data: itemsData } = await admin
    .from('items')
    .select('id, title, category, subcategory, colors, style_tags, brand, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  const items = (itemsData ?? []) as CompactItem[];
  if (items.length < MIN_ITEMS) {
    return jsonResponse({ error: 'not enough items', min_items: MIN_ITEMS }, 422);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('locale, style_preferences')
    .eq('id', userId)
    .single();

  const inputHash = await sha256(
    JSON.stringify({
      items: items.map((i) => [i.id, i.category, i.subcategory, i.colors, i.style_tags]),
      preferences: profile?.style_preferences ?? '',
      locale: profile?.locale ?? 'ro',
    }),
  );

  if (!regenerate) {
    const { data: cached } = await admin
      .from('recommendations')
      .select('payload')
      .eq('user_id', userId)
      .eq('kind', 'outfit')
      .eq('input_hash', inputHash)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) {
      return jsonResponse({ ...(cached.payload as OutfitRecs), cached: true });
    }
  }

  const budget = await checkAiBudget(admin, userId, 'outfit');
  if (!budget.ok) return jsonResponse({ error: budget.reason }, budget.status);

  const itemsById = new Map(items.map((i) => [i.id, i]));
  const prompt = buildPrompt(profile?.locale ?? 'ro', items, profile?.style_preferences ?? null);

  try {
    let recs: OutfitRecs | null = null;
    let totalPrompt = 0;
    let totalCompletion = 0;
    let model = '';
    for (let attempt = 0; attempt < 2 && !recs; attempt++) {
      const result = await chatCompletion(
        'text',
        [
          {
            role: 'user',
            content:
              attempt === 0
                ? prompt
                : prompt + '\nYour previous reply was invalid. Return ONLY the JSON object with valid provided ids.',
          },
        ],
        { maxTokens: 900, temperature: 0.6 },
      );
      totalPrompt += result.promptTokens;
      totalCompletion += result.completionTokens;
      model = result.model;
      try {
        const parsed = OutfitRecsSchema.parse(extractJson(result.content));
        recs = structurallyValid(parsed, itemsById) ? parsed : null;
      } catch {
        recs = null;
      }
    }

    await recordAiUsage(admin, {
      userId,
      endpoint: 'outfit',
      model,
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
    });

    if (!recs) return jsonResponse({ error: 'generation failed' }, 502);

    await admin.from('recommendations').insert({
      user_id: userId,
      kind: 'outfit',
      input_hash: inputHash,
      payload: recs,
      model,
      expires_at: new Date(Date.now() + CACHE_DAYS * 24 * 3600 * 1000).toISOString(),
    });

    return jsonResponse({ ...recs, cached: false });
  } catch (error) {
    if (error instanceof AiUnavailable) {
      return jsonResponse({ error: 'ai unavailable' }, 503);
    }
    throw error;
  }
});
