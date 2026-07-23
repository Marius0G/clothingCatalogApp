import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

import {
  addItemToCollection,
  createCollection,
  deleteCollection,
  listCollectionItems,
  listCollections,
  listCollectionSummaries,
  listItemCollectionIds,
  removeItemFromCollection,
} from './api';

export function useCollections() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['collections', userId],
    queryFn: () => listCollections(userId!),
    enabled: !!userId,
  });
}

export function useCollectionSummaries() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['collection-summaries', userId],
    queryFn: () => listCollectionSummaries(userId!),
    enabled: !!userId,
  });
}

export function useCreateCollection() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCollection(userId!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', userId] });
      queryClient.invalidateQueries({ queryKey: ['collection-summaries', userId] });
    },
  });
}

export function useDeleteCollection() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', session?.user.id] });
      queryClient.invalidateQueries({ queryKey: ['collection-summaries', session?.user.id] });
    },
  });
}

export function useCollectionItems(collectionId: string) {
  return useQuery({
    queryKey: ['collection-items', collectionId],
    queryFn: () => listCollectionItems(collectionId),
  });
}

export function useItemCollectionIds(itemId: string) {
  return useQuery({
    queryKey: ['item-collections', itemId],
    queryFn: () => listItemCollectionIds(itemId),
  });
}

export function useToggleItemInCollection(itemId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, member }: { collectionId: string; member: boolean }) =>
      member
        ? removeItemFromCollection(collectionId, itemId)
        : addItemToCollection(collectionId, itemId),
    onSuccess: (_data, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['item-collections', itemId] });
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection-summaries', session?.user.id] });
    },
  });
}
