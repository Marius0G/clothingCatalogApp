import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

import { getTrackedProduct, importFromLink, listWishlist, moveToWardrobe } from './api';

export function useTrackedProduct(itemId: string, enabled = true) {
  return useQuery({
    queryKey: ['tracked-product', itemId],
    queryFn: () => getTrackedProduct(itemId),
    enabled,
  });
}

export function useWishlist() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['wishlist', userId],
    queryFn: () => listWishlist(userId!),
    enabled: !!userId,
  });
}

export function useImportFromLink() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => importFromLink(url),
    onSuccess: (item) => {
      queryClient.setQueryData(['item', item.id], item);
      queryClient.invalidateQueries({ queryKey: ['wishlist', userId] });
      queryClient.invalidateQueries({ queryKey: ['items', userId] });
      queryClient.invalidateQueries({ queryKey: ['collection-items'] });
    },
  });
}

export function useMoveToWardrobe() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => moveToWardrobe(userId!, itemId),
    onSuccess: (item) => {
      queryClient.setQueryData(['item', item.id], item);
      queryClient.invalidateQueries({ queryKey: ['wishlist', userId] });
      queryClient.invalidateQueries({ queryKey: ['items', userId] });
      queryClient.invalidateQueries({ queryKey: ['collection-items'] });
    },
  });
}

/** "€79,99" / "129,90 lei" per design price rendering. */
export function formatPrice(price: number, currency: string | null): string {
  const amount = price.toFixed(2).replace('.', ',');
  switch (currency?.toUpperCase()) {
    case 'EUR':
      return `€${amount}`;
    case 'USD':
      return `$${amount}`;
    case 'GBP':
      return `£${amount}`;
    case 'RON':
    case 'LEI':
      return `${amount} lei`;
    default:
      return currency ? `${amount} ${currency}` : amount;
  }
}
