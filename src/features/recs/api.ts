import type { CatalogProduct, Occasion, OutfitRecs, Weather } from '@shared/types';

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

export async function getPurchases(regenerate = false): Promise<PurchaseRecsResponse> {
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
