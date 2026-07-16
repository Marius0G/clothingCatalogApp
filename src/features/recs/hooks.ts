import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

import { getOutfits, getPurchases, NotEnoughItems } from './api';

export { NotEnoughItems };

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

export function useOutfits() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['outfits', session?.user.id],
    queryFn: () => getOutfits(false),
    enabled: !!session,
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => !(error instanceof NotEnoughItems) && failureCount < 2,
  });
}

export function useRegenerateOutfits() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getOutfits(true),
    onSuccess: (recs) => {
      queryClient.setQueryData(['outfits', session?.user.id], recs);
    },
  });
}
