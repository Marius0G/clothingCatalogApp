import type { OutfitRecs } from '@shared/types';

import { supabase } from '@/lib/supabase';

export type OutfitRecsResponse = OutfitRecs & { cached: boolean };

export class NotEnoughItems extends Error {}

export async function getOutfits(regenerate = false): Promise<OutfitRecsResponse> {
  const { data, error } = await supabase.functions.invoke('recommend-outfits', {
    body: { regenerate },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 422) throw new NotEnoughItems();
    throw error;
  }
  return data as OutfitRecsResponse;
}
