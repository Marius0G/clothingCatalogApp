/**
 * Outfit engine v2 — the pure pipeline shared by the recommend-outfits edge
 * function, the app's on-device path, and quality evals: deterministic
 * candidate prefilter → compose prompt → deterministic rule scorer (color
 * harmony, formality, warmth vs weather, occasion, slots) → diverse selection.
 * Keep dependency-free except zod (via ./types.ts); no IO here.
 */
import {
  CanonicalColorSchema,
  type Occasion,
  type Outfit,
  type OutfitRecs,
  type Weather,
} from './types.ts';

export const REQUESTED_OUTFITS = 6; // asked from the LLM
export const RETURNED_OUTFITS = 4; // best-scored subset returned to the app
export const MIN_ACCEPTED = 2; // fewer good outfits than this → retry the LLM
export const MAX_CANDIDATES = 60; // prompt-size guard for large wardrobes
export const MIN_POOL = 8; // a prefilter never shrinks the pool below this

export type CompactItem = {
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

export type OutfitContext = {
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

// ---------- candidate prefilter (stage B: retrieve-then-compose) ----------

export function filterCandidates(items: CompactItem[], ctx: OutfitContext): CompactItem[] {
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

export function buildOutfitPrompt(
  locale: string,
  items: CompactItem[],
  preferences: string | null,
  noGo: string | null,
  ctx: OutfitContext,
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

export function scoreOutfit(
  outfit: Outfit,
  itemsById: Map<string, CompactItem>,
  ctx: OutfitContext,
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
export function selectDiverse(
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

export function evaluateOutfits(
  parsed: OutfitRecs,
  itemsById: Map<string, CompactItem>,
  ctx: OutfitContext,
): { accepted: Outfit[]; anyValid: Outfit[]; problems: string[]; scores: number[] } {
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
    scores: scored.map((s) => s.score),
  };
}
