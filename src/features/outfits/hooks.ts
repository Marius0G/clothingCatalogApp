import type { Item, Outfit } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/provider';
import { useItems } from '@/features/wardrobe/hooks';
import { useWishlist } from '@/features/wishlist/hooks';

import {
  deleteOutfit,
  listOutfitFeedback,
  listSavedOutfits,
  outfitItemsKey,
  recordWear,
  saveOutfit,
  sendOutfitFeedback,
  type OutfitVote,
} from './api';

export { outfitItemsKey };
export type { OutfitVote };

/** Every item an outfit can reference (wardrobe + wishlist), keyed by id. */
export function useItemLookup(): Map<string, Item> {
  const { data: wardrobeItems } = useItems('wardrobe');
  const { data: wishlistEntries } = useWishlist();
  return useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of wardrobeItems ?? []) map.set(item.id, item);
    for (const entry of wishlistEntries ?? []) {
      const { tracked_product: _tp, ...item } = entry;
      map.set(item.id, item as Item);
    }
    return map;
  }, [wardrobeItems, wishlistEntries]);
}

export function useSavedOutfits() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['saved-outfits', userId],
    queryFn: () => listSavedOutfits(userId!),
    enabled: !!userId,
  });
}

export function useSaveOutfit() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ outfit, occasion }: { outfit: Outfit; occasion: string | null }) =>
      saveOutfit(userId!, outfit, occasion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-outfits', userId] });
    },
  });
}

export function useDeleteOutfit() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOutfit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-outfits', session?.user.id] });
    },
  });
}

/** Map of outfitItemsKey → vote, to restore thumb state across sessions. */
export function useOutfitVotes() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['outfit-feedback', userId],
    queryFn: async () => {
      const entries = await listOutfitFeedback(userId!);
      const byKey = new Map<string, OutfitVote>();
      // entries are newest-first; keep the newest vote per item set
      for (const entry of entries) {
        const key = outfitItemsKey(entry.item_ids);
        if (!byKey.has(key)) byKey.set(key, entry.vote);
      }
      return byKey;
    },
    enabled: !!userId,
  });
}

export function useSendOutfitFeedback() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      outfit,
      occasion,
      vote,
    }: {
      outfit: Outfit;
      occasion: string | null;
      vote: OutfitVote | null;
    }) => sendOutfitFeedback(userId!, outfit, occasion, vote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfit-feedback', userId] });
    },
  });
}

export function useRecordWear() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) => recordWear(itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', session?.user.id] });
      queryClient.invalidateQueries({ queryKey: ['item'] });
    },
  });
}
