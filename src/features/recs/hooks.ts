import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

import { getOutfits, getPurchases, MIN_OUTFIT_ITEMS, NotEnoughItems, type OutfitContext } from './api';

export { MIN_OUTFIT_ITEMS, NotEnoughItems };
export type { OutfitContext };

function outfitsKey(userId: string | undefined, context: OutfitContext) {
  return [
    'outfits',
    userId,
    context.occasion ?? null,
    context.weather ?? null,
    context.anchorItemId ?? null,
  ];
}

export function usePurchases(enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['purchases', session?.user.id],
    queryFn: () => getPurchases(false),
    enabled: !!session && enabled,
    staleTime: 10 * 60 * 1000,
    // Suggestions must survive the wardrobe tab's clothes⇄outfits unmounts.
    gcTime: 60 * 60 * 1000,
    retry: (failureCount, error) => !(error instanceof NotEnoughItems) && failureCount < 2,
  });
}

export function useOutfits(context: OutfitContext) {
  const { session } = useAuth();
  return useQuery({
    queryKey: outfitsKey(session?.user.id, context),
    queryFn: () => getOutfits(context, false),
    // On-demand only: outfits generate when the user taps Generate (refetch),
    // never automatically on screen open. Results stay cached per context.
    enabled: false,
    staleTime: 10 * 60 * 1000,
    // Generated outfits are expensive — keep them cached across the wardrobe
    // tab's clothes⇄outfits view switches (default 5-min gcTime evicts them).
    gcTime: 60 * 60 * 1000,
    retry: (failureCount, error) => !(error instanceof NotEnoughItems) && failureCount < 2,
  });
}

export function useRegenerateOutfits(context: OutfitContext) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getOutfits(context, true),
    onSuccess: (recs) => {
      queryClient.setQueryData(outfitsKey(session?.user.id, context), recs);
    },
  });
}
