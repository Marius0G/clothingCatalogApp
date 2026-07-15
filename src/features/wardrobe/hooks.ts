import type { Item, ItemStatus, ItemUpdate } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

import {
  createPhotoItem,
  deleteItem,
  getItem,
  getSignedImageUrl,
  listItems,
  requestAutoTags,
  updateItem,
  type NewPhotoItem,
} from './api';

export function useItems(status: ItemStatus) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['items', userId, status],
    queryFn: () => listItems(userId!, status),
    enabled: !!userId,
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: () => getItem(id),
  });
}

export function useCreatePhotoItem() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPhotoItem) => createPhotoItem(userId!, input),
    onSuccess: (item) => {
      queryClient.setQueryData(['item', item.id], item);
      queryClient.invalidateQueries({ queryKey: ['items', userId] });
    },
  });
}

export function useUpdateItem() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: ItemUpdate }) => updateItem(id, update),
    onSuccess: (item) => {
      queryClient.setQueryData(['item', item.id], item);
      queryClient.invalidateQueries({ queryKey: ['items', session?.user.id] });
    },
  });
}

export function useDeleteItem() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: Item) => deleteItem(item),
    onSuccess: (_data, item) => {
      queryClient.removeQueries({ queryKey: ['item', item.id] });
      queryClient.invalidateQueries({ queryKey: ['items', session?.user.id] });
      queryClient.invalidateQueries({ queryKey: ['collection-items'] });
    },
  });
}

/** Requests vision auto-tagging in the background and refreshes caches when it lands. */
export function useRequestAutoTags() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return (itemId: string) => {
    requestAutoTags(itemId).then((item) => {
      if (item) {
        queryClient.setQueryData(['item', item.id], item);
        queryClient.invalidateQueries({ queryKey: ['items', session?.user.id] });
      }
    });
  };
}

/** Signed URL for a private storage path; cached just under the URL's lifetime. */
export function useSignedImageUrl(path: string | null) {
  return useQuery({
    queryKey: ['signed-url', path],
    queryFn: () => getSignedImageUrl(path!),
    enabled: !!path,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
