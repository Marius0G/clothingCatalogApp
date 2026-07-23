// Outfit recommendations from the user's wardrobe — engine v2.
// Pipeline (docs/spike-outfit-engine.md): deterministic candidate prefilter
// (occasion/weather over the v2 item attributes) → one LLM compose call that
// asks for 6 candidate outfits → deterministic rule scorer (color harmony,
// formality consistency, warmth vs weather, occasion coherence, slots,
// diversity) that returns the best few. Persisted feedback and wear history
// are injected as few-shot signals. Cached in `recommendations` keyed by a
// hash of wardrobe state + preferences + request context + feedback state.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AiUnavailable, chatCompletion, extractJson } from '../_shared/featherless.ts';
import {
  buildOutfitPrompt,
  evaluateOutfits,
  filterCandidates,
  MIN_ACCEPTED,
  type CompactItem,
  type OutfitContext,
} from '../_shared/outfitEngine.ts';
import { checkAiBudget, recordAiUsage } from '../_shared/rateLimit.ts';
import {
  OutfitRecsSchema,
  OutfitRequestSchema,
  type Outfit,
  type OutfitRecs,
} from '../_shared/types.ts';

const CACHE_DAYS = 7;
const MIN_ITEMS = 4;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- handler ----------

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
  const request = OutfitRequestSchema.safeParse(body ?? {});
  if (!request.success) return jsonResponse({ error: 'invalid request' }, 400);
  const regenerate = request.data.regenerate === true;

  // Wardrobe only: recommending outfits from wishlist items the user doesn't
  // own defeats the purpose — those belong to purchase suggestions.
  const { data: itemsData } = await admin
    .from('items')
    .select(
      'id, title, category, subcategory, colors, style_tags, brand, formality, warmth, seasons, occasions, layer, material, pattern, times_worn',
    )
    .eq('user_id', userId)
    .eq('status', 'wardrobe')
    .order('created_at', { ascending: true });
  const allItems = (itemsData ?? []) as CompactItem[];
  if (allItems.length < MIN_ITEMS) {
    return jsonResponse({ error: 'not enough items', min_items: MIN_ITEMS }, 422);
  }

  const ctx: OutfitContext = {
    occasion: request.data.occasion ?? null,
    weather: request.data.weather ?? null,
    // Drop silently if the anchor isn't a wardrobe item (deleted/moved).
    anchorItemId: allItems.some((i) => i.id === request.data.anchor_item_id)
      ? (request.data.anchor_item_id ?? null)
      : null,
  };

  const { data: profile } = await admin
    .from('profiles')
    .select('locale, style_preferences, no_go, preferred_styles, favorite_colors, favorite_brands')
    .eq('id', userId)
    .single();

  // Structured preferences + free notes, composed into one prompt block.
  const preferenceBlock = [
    profile?.preferred_styles?.length
      ? `Preferred styles: ${profile.preferred_styles.join(', ')}`
      : '',
    profile?.favorite_colors?.length
      ? `Favorite colors: ${profile.favorite_colors.join(', ')}`
      : '',
    profile?.favorite_brands?.length
      ? `Favorite brands: ${profile.favorite_brands.join(', ')}`
      : '',
    profile?.style_preferences ? `Notes: ${profile.style_preferences}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  // Persisted feedback + wear history → few-shot personalization signals.
  const { data: feedback } = await admin
    .from('outfit_feedback')
    .select('id, item_ids, vote')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  const itemsById = new Map(allItems.map((i) => [i.id, i]));
  const titleOf = (id: string) => itemsById.get(id)?.title ?? null;
  const signals: string[] = [];
  for (const row of feedback ?? []) {
    const titles = (row.item_ids as string[]).map(titleOf).filter(Boolean);
    if (titles.length < 2) continue;
    signals.push(
      `- ${row.vote === 'up' ? 'Liked' : 'Disliked'} outfit: ${titles.join(' + ')}`,
    );
  }
  const mostWorn = allItems
    .filter((i) => i.times_worn > 0 && i.title)
    .sort((a, b) => b.times_worn - a.times_worn)
    .slice(0, 5);
  if (mostWorn.length) {
    signals.push(`- Wears most often: ${mostWorn.map((i) => i.title).join(', ')}`);
  }

  const candidates = filterCandidates(allItems, ctx);

  const inputHash = await sha256(
    JSON.stringify({
      // v3: 20-slug style vocabulary + structured preferences (migration 0004).
      v: 3,
      items: candidates.map((i) => [
        i.id, i.category, i.subcategory, i.colors, i.style_tags,
        i.formality, i.warmth, i.seasons, i.occasions, i.layer,
      ]),
      preferences: profile?.style_preferences ?? '',
      preferred_styles: profile?.preferred_styles ?? [],
      favorite_colors: profile?.favorite_colors ?? [],
      favorite_brands: profile?.favorite_brands ?? [],
      no_go: profile?.no_go ?? '',
      locale: profile?.locale ?? 'ro',
      occasion: ctx.occasion,
      weather: ctx.weather,
      anchor: ctx.anchorItemId,
      feedback: `${(feedback ?? [])[0]?.id ?? ''}:${(feedback ?? []).length}`,
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

  const prompt = buildOutfitPrompt(
    profile?.locale ?? 'ro',
    candidates,
    preferenceBlock || null,
    profile?.no_go ?? null,
    ctx,
    signals,
  );

  try {
    let recs: OutfitRecs | null = null;
    let fallback: Outfit[] = [];
    let problems: string[] = [];
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
                : `${prompt}\nYour previous reply was rejected: ${
                    problems.join('; ') || 'it was not a valid JSON object matching the schema'
                  }. Fix these issues and return ONLY the JSON object with valid provided ids.`,
          },
        ],
        { maxTokens: 1400, temperature: 0.6 },
      );
      totalPrompt += result.promptTokens;
      totalCompletion += result.completionTokens;
      model = result.model;
      try {
        const parsed = OutfitRecsSchema.parse(extractJson(result.content));
        const evaluated = evaluateOutfits(parsed, itemsById, ctx);
        problems = evaluated.problems;
        if (evaluated.anyValid.length > fallback.length) fallback = evaluated.anyValid;
        if (evaluated.accepted.length >= MIN_ACCEPTED) {
          recs = { outfits: evaluated.accepted };
        }
      } catch {
        problems = [];
      }
    }
    // Retries exhausted: ship the best structurally-valid outfits over a 502.
    if (!recs && fallback.length > 0) recs = { outfits: fallback };

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
