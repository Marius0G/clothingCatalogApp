import { SavedOutfitSchema, type Outfit, type SavedOutfit } from '@shared/types';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

export type OutfitVote = 'up' | 'down';

export type SavedOutfitWithItems = SavedOutfit & { item_ids: string[] };

const SavedOutfitRowSchema = SavedOutfitSchema.extend({
  outfit_items: z.array(z.object({ item_id: z.uuid(), position: z.number().int() })),
});

/** Stable key for "the same set of items" regardless of order. */
export function outfitItemsKey(itemIds: string[]): string {
  return [...itemIds].sort().join('|');
}

export async function listSavedOutfits(userId: string): Promise<SavedOutfitWithItems[]> {
  const { data, error } = await supabase
    .from('outfits')
    .select('*, outfit_items(item_id, position)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return z
    .array(SavedOutfitRowSchema)
    .parse(data)
    .map(({ outfit_items, ...outfit }) => ({
      ...outfit,
      item_ids: [...outfit_items].sort((a, b) => a.position - b.position).map((r) => r.item_id),
    }));
}

export async function saveOutfit(
  userId: string,
  outfit: Outfit,
  requestedOccasion: string | null,
): Promise<SavedOutfitWithItems> {
  const { data, error } = await supabase
    .from('outfits')
    .insert({
      user_id: userId,
      title: outfit.occasion,
      rationale: outfit.rationale,
      occasion: requestedOccasion,
      source: 'ai',
    })
    .select()
    .single();
  if (error) throw error;
  const saved = SavedOutfitSchema.parse(data);
  const { error: itemsError } = await supabase.from('outfit_items').insert(
    outfit.item_ids.map((item_id, position) => ({ outfit_id: saved.id, item_id, position })),
  );
  if (itemsError) throw itemsError;
  return { ...saved, item_ids: outfit.item_ids };
}

export async function deleteOutfit(id: string): Promise<void> {
  const { error } = await supabase.from('outfits').delete().eq('id', id);
  if (error) throw error;
}

export type FeedbackEntry = { item_ids: string[]; vote: OutfitVote };

export async function listOutfitFeedback(userId: string): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase
    .from('outfit_feedback')
    .select('item_ids, vote')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as FeedbackEntry[];
}

/**
 * One feedback row per item set: clears any previous vote on the same outfit,
 * then records the new one (or nothing, when un-voting).
 */
export async function sendOutfitFeedback(
  userId: string,
  outfit: Outfit,
  requestedOccasion: string | null,
  vote: OutfitVote | null,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('outfit_feedback')
    .delete()
    .eq('user_id', userId)
    .contains('item_ids', outfit.item_ids)
    .containedBy('item_ids', outfit.item_ids);
  if (deleteError) throw deleteError;
  if (!vote) return;
  const { error } = await supabase.from('outfit_feedback').insert({
    user_id: userId,
    item_ids: outfit.item_ids,
    occasion: requestedOccasion,
    vote,
  });
  if (error) throw error;
}

/** Marks every item in the list as worn today (times_worn + last_worn_at). */
export async function recordWear(itemIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('record_wear', { p_item_ids: itemIds });
  if (error) throw error;
}
