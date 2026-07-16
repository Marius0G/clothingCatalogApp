import type { Outfit } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

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
