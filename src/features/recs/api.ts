import { type CompactItem, type OutfitContext as EngineContext } from '@shared/outfitEngine';
import type { PurchaseCandidate, PurchaseWardrobeItem } from '@shared/prompts';
import type { CatalogProduct, Occasion, OutfitRecs, Weather } from '@shared/types';

// Feature→feature dependency, deliberate: local-ai is infrastructure the data
// layer branches on, so the cloud/local split stays invisible to callers.
import {
  ensureLocalAiSynced,
  isLocalAiAvailable,
  localOutfitRecs,
  localPurchaseRecs,
} from '@/features/local-ai/api';
import i18n from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export type OutfitRecsResponse = OutfitRecs & { cached: boolean };

/** Request context for outfit generation (all optional). */
export type OutfitContext = {
  occasion?: Occasion | null;
  weather?: Weather | null;
  anchorItemId?: string | null;
};

export type PurchaseSuggestion = {
  catalog_product_id: string;
  rationale: string;
  product: CatalogProduct | null;
};
export type PurchaseRecsResponse = { suggestions: PurchaseSuggestion[]; cached: boolean };

export class NotEnoughItems extends Error {}

// Parity with the edge functions' 422 thresholds.
/** Parity with the edge functions' 422 thresholds — UI gates must match. */
export const MIN_OUTFIT_ITEMS = 4;
const MIN_PURCHASE_ITEMS = 3;
const PURCHASE_CANDIDATE_LIMIT = 80;

const recLocale = () => (i18n.language === 'ro' ? 'ro' : 'en');

type RecsProfile = {
  locale: string | null;
  style_preferences: string | null;
  no_go: string | null;
  sex: string | null;
  preferred_styles: string[] | null;
  favorite_colors: string[] | null;
  favorite_brands: string[] | null;
};

async function fetchRecsProfile(userId: string): Promise<RecsProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('locale, style_preferences, no_go, sex, preferred_styles, favorite_colors, favorite_brands')
    .eq('id', userId)
    .single();
  return (data as RecsProfile | null) ?? null;
}

/** Same composition as the edge functions' preference block. */
function preferenceBlock(profile: RecsProfile | null): string {
  return [
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
}

/**
 * On-device variant of recommend-outfits: same data the edge fn assembles,
 * fetched under RLS, run through the shared engine + local model. Null on
 * failure (→ cloud fallback); NotEnoughItems propagates like the cloud 422.
 */
async function getOutfitsLocally(context: OutfitContext): Promise<OutfitRecsResponse | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data: itemsData, error } = await supabase
    .from('items')
    .select(
      'id, title, category, subcategory, colors, style_tags, brand, formality, warmth, seasons, occasions, layer, material, pattern, times_worn',
    )
    .eq('user_id', userId)
    .eq('status', 'wardrobe')
    .order('created_at', { ascending: true });
  if (error) return null;
  const allItems = (itemsData ?? []) as CompactItem[];
  if (allItems.length < MIN_OUTFIT_ITEMS) throw new NotEnoughItems();

  const profile = await fetchRecsProfile(userId);

  const { data: feedback } = await supabase
    .from('outfit_feedback')
    .select('id, item_ids, vote')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  const itemsById = new Map(allItems.map((item) => [item.id, item]));
  const titleOf = (id: string) => itemsById.get(id)?.title ?? null;
  const signals: string[] = [];
  for (const row of feedback ?? []) {
    const titles = (row.item_ids as string[]).map(titleOf).filter(Boolean);
    if (titles.length < 2) continue;
    signals.push(`- ${row.vote === 'up' ? 'Liked' : 'Disliked'} outfit: ${titles.join(' + ')}`);
  }
  const mostWorn = allItems
    .filter((item) => item.times_worn > 0 && item.title)
    .sort((a, b) => b.times_worn - a.times_worn)
    .slice(0, 5);
  if (mostWorn.length) {
    signals.push(`- Wears most often: ${mostWorn.map((item) => item.title).join(', ')}`);
  }

  const ctx: EngineContext = {
    occasion: context.occasion ?? null,
    weather: context.weather ?? null,
    anchorItemId: allItems.some((item) => item.id === context.anchorItemId)
      ? (context.anchorItemId ?? null)
      : null,
  };

  const recs = await localOutfitRecs(
    allItems,
    ctx,
    preferenceBlock(profile) || null,
    profile?.no_go ?? null,
    signals,
    profile?.locale ?? recLocale(),
  );
  return recs ? { ...recs, cached: false } : null;
}

/** On-device variant of recommend-purchases; same shape as the cloud reply. */
async function getPurchasesLocally(): Promise<PurchaseRecsResponse | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data: itemsData, error } = await supabase
    .from('items')
    .select('title, category, subcategory, colors, style_tags, brand, formality, material, occasions')
    .eq('user_id', userId);
  if (error) return null;
  const items = (itemsData ?? []) as PurchaseWardrobeItem[];
  if (items.length < MIN_PURCHASE_ITEMS) throw new NotEnoughItems();

  const profile = await fetchRecsProfile(userId);

  let query = supabase
    .from('catalog_products')
    .select('id, title, brand, price, currency, category, url, affiliate_url, image_url, merchant, source, network')
    .eq('active', true)
    .order('last_seen_at', { ascending: false })
    .limit(PURCHASE_CANDIDATE_LIMIT);
  if (profile?.sex === 'male') query = query.or('gender.is.null,gender.in.(male,unisex)');
  if (profile?.sex === 'female') query = query.or('gender.is.null,gender.in.(female,unisex)');
  const { data: candidates } = await query;
  if (!candidates || candidates.length < 3) return null; // cloud path reports 'catalog empty'

  const recs = await localPurchaseRecs(
    items,
    candidates.map(
      (c): PurchaseCandidate => ({
        id: c.id,
        title: c.title,
        brand: c.brand,
        price: c.price,
        currency: c.currency,
        category: c.category,
      }),
    ),
    preferenceBlock(profile) || null,
    profile?.no_go ?? null,
    profile?.locale ?? recLocale(),
  );
  if (!recs) return null;

  const productById = new Map(candidates.map((c) => [c.id, c]));
  return {
    suggestions: recs.suggestions.map((s) => ({
      ...s,
      product: (productById.get(s.catalog_product_id) ?? null) as CatalogProduct | null,
    })),
    cached: false,
  };
}

export async function getPurchases(regenerate = false): Promise<PurchaseRecsResponse> {
  await ensureLocalAiSynced();
  if (isLocalAiAvailable()) {
    try {
      const local = await getPurchasesLocally();
      if (local) return local;
    } catch (error) {
      if (error instanceof NotEnoughItems) throw error;
    }
  }
  const { data, error } = await supabase.functions.invoke('recommend-purchases', {
    body: { regenerate },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 422) throw new NotEnoughItems();
    throw error;
  }
  return data as PurchaseRecsResponse;
}

export async function getOutfits(
  context: OutfitContext = {},
  regenerate = false,
): Promise<OutfitRecsResponse> {
  await ensureLocalAiSynced();
  if (isLocalAiAvailable()) {
    try {
      const local = await getOutfitsLocally(context);
      if (local) return local;
    } catch (error) {
      if (error instanceof NotEnoughItems) throw error;
    }
  }
  const { data, error } = await supabase.functions.invoke('recommend-outfits', {
    body: {
      regenerate,
      occasion: context.occasion ?? undefined,
      weather: context.weather ?? undefined,
      anchor_item_id: context.anchorItemId ?? undefined,
    },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 422) throw new NotEnoughItems();
    throw error;
  }
  return data as OutfitRecsResponse;
}
