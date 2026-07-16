import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

import { getOutfits, getPurchases, NotEnoughItems, type OutfitContext } from './api';

export { NotEnoughItems };
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

export function usePurchases() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['purchases', session?.user.id],
    queryFn: () => getPurchases(false),
    enabled: !!session,
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => !(error instanceof NotEnoughItems) && failureCount < 2,
  });
}

export function useOutfits(context: OutfitContext) {
  const { session } = useAuth();
  return useQuery({
    queryKey: outfitsKey(session?.user.id, context),
    queryFn: () => getOutfits(context, false),
    enabled: !!session,
    staleTime: 10 * 60 * 1000,
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
