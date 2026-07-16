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
import { checkAiBudget, recordAiUsage } from '../_shared/rateLimit.ts';
import {
  CanonicalColorSchema,
  OutfitRecsSchema,
  OutfitRequestSchema,
  type Occasion,
  type Outfit,
  type OutfitRecs,
  type Weather,
} from '../_shared/types.ts';

const CACHE_DAYS = 7;
const MIN_ITEMS = 4;
const REQUESTED_OUTFITS = 6; // asked from the LLM
const RETURNED_OUTFITS = 4; // best-scored subset returned to the app
const MIN_ACCEPTED = 2; // fewer good outfits than this → retry the LLM
const MAX_CANDIDATES = 60; // prompt-size guard for large wardrobes
const MIN_POOL = 8; // a prefilter never shrinks the pool below this

type CompactItem = {
  id: string;
  title: string | null;
  category: string | null;
  subcategory: string | null;
  colors: string[];
  style_tags: string[];
  brand: string | null;
  formality: number | null;
  warmth: number | null;
  seasons: string[];
  occasions: string[];
  layer: string | null;
  material: string | null;
  pattern: string | null;
  times_worn: number;
};

type Context = {
  occasion: Occasion | null;
  weather: Weather | null;
  anchorItemId: string | null;
};

const CANONICAL_COLORS = new Set<string>(CanonicalColorSchema.options);
// Neutrals per the 3-color rule: they form the base and never count against
// the accent budget. Legacy localized color words are simply not scored.
const NEUTRALS = new Set([
  'black', 'white', 'cream', 'beige', 'tan', 'brown', 'grey', 'silver', 'navy', 'olive',
]);

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- candidate prefilter (stage B: retrieve-then-compose) ----------

function filterCandidates(items: CompactItem[], ctx: Context): CompactItem[] {
  let pool = items;
  const keepAnchor = (item: CompactItem) => item.id === ctx.anchorItemId;
  const apply = (pred: (item: CompactItem) => boolean) => {
    const next = pool.filter((item) => pred(item) || keepAnchor(item));
    if (next.length >= MIN_POOL) pool = next;
  };

  // Untagged items (warmth/occasions null/empty) always pass — they predate
  // migration 0003 and shouldn't vanish from recommendations.
  if (ctx.weather === 'hot') apply((i) => (i.warmth ?? 3) <= 3);
  if (ctx.weather === 'cold') apply((i) => (i.warmth ?? 3) >= 2);
  if (ctx.occasion) {
    apply((i) => i.occasions.length === 0 || i.occasions.includes(ctx.occasion!));
  }

  if (pool.length > MAX_CANDIDATES) {
    // items arrive ordered created_at asc — keep the newest, plus the anchor
    const newest = pool.slice(-MAX_CANDIDATES);
    const anchor = pool.find(keepAnchor);
    pool = anchor && !newest.includes(anchor) ? [anchor, ...newest.slice(1)] : newest;
  }
  return pool;
}

// ---------- prompt ----------

function compactForPrompt(item: CompactItem): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: item.id,
    title: item.title,
    category: item.category,
    subcategory: item.subcategory,
    colors: item.colors,
    style_tags: item.style_tags,
  };
  if (item.brand) out.brand = item.brand;
  if (item.formality != null) out.formality = item.formality;
  if (item.warmth != null) out.warmth = item.warmth;
  if (item.layer && item.layer !== 'none') out.layer = item.layer;
  if (item.material) out.material = item.material;
  if (item.pattern && item.pattern !== 'solid') out.pattern = item.pattern;
  if (item.seasons.length) out.seasons = item.seasons;
  if (item.occasions.length) out.occasions = item.occasions;
  return out;
}

function buildPrompt(
  locale: string,
  items: CompactItem[],
  preferences: string | null,
  noGo: string | null,
  ctx: Context,
  signals: string[],
): string {
  const lang = locale === 'ro' ? 'Romanian' : 'English';
  return [
    `You are a personal stylist. Combine ONLY the wardrobe items below into ${REQUESTED_OUTFITS} different outfits.`,
    ctx.occasion ? `Occasion: ${ctx.occasion} — every outfit must suit it.` : '',
    ctx.weather ? `Weather: ${ctx.weather} — pick warmth-appropriate items and layers.` : '',
    ctx.anchorItemId
      ? `Every outfit MUST include the item with id "${ctx.anchorItemId}" and be built around it.`
      : '',
    'Rules:',
    '- Use only the provided "id" values; never invent ids.',
    '- Each outfit: 2-6 items, at most one "bottom", at most one "shoes", at most one "dress".',
    '- A "dress" outfit must not also contain a "top" and "bottom" pair.',
    '- Include shoes in an outfit whenever a suitable pair exists.',
    '- Colors: build each outfit on neutrals (black, white, cream, beige, tan, brown, grey, navy, olive); use at most 3 color families and at most 1 bright accent color.',
    '- Keep "formality" values within 1 level of each other inside an outfit.',
    '- Respect the "warmth", "seasons" and "occasions" attributes when matching the context above.',
    `- Make the ${REQUESTED_OUTFITS} outfits distinct from each other: do not use the same key piece in more than 2 of them.`,
    `- "occasion" is a short outfit name and "rationale" one sentence explaining why it works, both in ${lang}.`,
    'Return ONLY a JSON object: {"outfits":[{"item_ids":["..."],"occasion":"...","rationale":"..."}]}',
    preferences ? `User preferences: ${preferences}` : '',
    noGo ? `The user NEVER wears (hard exclusions): ${noGo}` : '',
    signals.length ? `Signals from the user's history:\n${signals.join('\n')}` : '',
    'Wardrobe items (JSON):',
    JSON.stringify(items.map(compactForPrompt)),
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------- rule scorer (stage A: deterministic verification) ----------

type ScoreResult = { score: number } | { reject: string };

function scoreOutfit(
  outfit: Outfit,
  itemsById: Map<string, CompactItem>,
  ctx: Context,
): ScoreResult {
  const maybe = outfit.item_ids.map((id) => itemsById.get(id));
  if (maybe.some((item) => !item)) return { reject: 'an outfit used an unknown item id' };
  const items = maybe as CompactItem[];
  const count = (category: string) => items.filter((i) => i.category === category).length;

  if (count('bottom') > 1 || count('shoes') > 1 || count('dress') > 1) {
    return { reject: 'an outfit doubled a bottom/shoes/dress slot' };
  }
  if (count('dress') === 1 && count('bottom') > 0) {
    return { reject: 'an outfit combined a dress with a bottom' };
  }
  const categorized = items.filter((i) => i.category != null);
  if (categorized.length === items.length && count('top') + count('dress') + count('outerwear') === 0) {
    return { reject: 'an outfit had no top, dress or outerwear' };
  }
  if (ctx.anchorItemId && !outfit.item_ids.includes(ctx.anchorItemId)) {
    return { reject: 'an outfit missed the required anchor item' };
  }

  let score = 0;

  // Color harmony — 3-color rule: neutral base, few accent families.
  const accents = new Set<string>();
  let hasNeutral = false;
  for (const item of items) {
    for (const color of item.colors) {
      if (!CANONICAL_COLORS.has(color)) continue; // legacy localized values
      if (NEUTRALS.has(color)) hasNeutral = true;
      else accents.add(color);
    }
  }
  if (hasNeutral) score += 1;
  if (accents.size <= 1) score += 2;
  else if (accents.size >= 3) score -= 2 * (accents.size - 2);

  // Formality consistency — spread of at most one level.
  const formalities = items
    .map((i) => i.formality)
    .filter((f): f is number => f != null);
  if (formalities.length >= 2) {
    const spread = Math.max(...formalities) - Math.min(...formalities);
    if (spread <= 1) score += 2;
    else if (spread === 2) score -= 1;
    else score -= 3;
  }

  // Warmth vs weather + layering completeness.
  const warmth = (item: CompactItem) => item.warmth ?? 3;
  if (ctx.weather === 'hot') {
    if (items.some((i) => warmth(i) >= 4)) score -= 3;
    if (items.every((i) => warmth(i) <= 2)) score += 1;
  } else if (ctx.weather === 'cold') {
    const hasOuter = items.some((i) => i.category === 'outerwear' || i.layer === 'outer');
    score += hasOuter ? 2 : -2;
    if (items.some((i) => i.category !== 'accessory' && warmth(i) === 1)) score -= 1;
  } else if (ctx.weather === 'cool') {
    if (items.some((i) => i.layer === 'outer' || i.layer === 'mid')) score += 1;
  }

  // Occasion coherence — over items that carry occasion tags.
  if (ctx.occasion) {
    const tagged = items.filter((i) => i.occasions.length > 0);
    if (tagged.length > 0) {
      const matched = tagged.filter((i) => i.occasions.includes(ctx.occasion!)).length;
      const fraction = matched / tagged.length;
      if (fraction >= 0.5) score += 2;
      else if (fraction === 0) score -= 2;
    }
  }

  // Completeness — a real outfit usually leaves the house with shoes.
  if (count('shoes') === 1) score += 1;

  return { score };
}

/** Greedy top-N by score, skipping outfits sharing >2 items with a pick. */
function selectDiverse(
  scored: { outfit: Outfit; score: number }[],
  max: number,
): Outfit[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: typeof sorted = [];
  for (const candidate of sorted) {
    if (picked.length >= max) break;
    const overlapping = picked.some(
      (p) => p.outfit.item_ids.filter((id) => candidate.outfit.item_ids.includes(id)).length > 2,
    );
    if (!overlapping) picked.push(candidate);
  }
  for (const candidate of sorted) {
    if (picked.length >= Math.min(max, sorted.length)) break;
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  return picked.map((p) => p.outfit);
}

function evaluate(
  parsed: OutfitRecs,
  itemsById: Map<string, CompactItem>,
  ctx: Context,
): { accepted: Outfit[]; anyValid: Outfit[]; problems: string[] } {
  const scored: { outfit: Outfit; score: number }[] = [];
  const problems: string[] = [];
  for (const outfit of parsed.outfits) {
    const result = scoreOutfit(outfit, itemsById, ctx);
    if ('reject' in result) problems.push(result.reject);
    else scored.push({ outfit, score: result.score });
  }
  const good = scored.filter((s) => s.score >= 0);
  if (scored.length > 0 && good.length < MIN_ACCEPTED) {
    problems.push(
      'outfits scored poorly on color harmony / formality consistency / weather fit — follow the color and formality rules strictly',
    );
  }
  return {
    accepted: selectDiverse(good, RETURNED_OUTFITS),
    anyValid: selectDiverse(scored, RETURNED_OUTFITS),
    problems,
  };
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

  const ctx: Context = {
    occasion: request.data.occasion ?? null,
    weather: request.data.weather ?? null,
    // Drop silently if the anchor isn't a wardrobe item (deleted/moved).
    anchorItemId: allItems.some((i) => i.id === request.data.anchor_item_id)
      ? (request.data.anchor_item_id ?? null)
      : null,
  };

  const { data: profile } = await admin
    .from('profiles')
    .select('locale, style_preferences, no_go')
    .eq('id', userId)
    .single();

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
      v: 2,
      items: candidates.map((i) => [
        i.id, i.category, i.subcategory, i.colors, i.style_tags,
        i.formality, i.warmth, i.seasons, i.occasions, i.layer,
      ]),
      preferences: profile?.style_preferences ?? '',
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

  const prompt = buildPrompt(
    profile?.locale ?? 'ro',
    candidates,
    profile?.style_preferences ?? null,
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
        const evaluated = evaluate(parsed, itemsById, ctx);
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
