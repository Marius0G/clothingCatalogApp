import { CollectionSchema, ItemSchema, type Collection, type Item } from '@shared/types';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

export async function listCollections(userId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('is_system', { ascending: false })
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return z.array(CollectionSchema).parse(data);
}

export async function createCollection(userId: string, name: string): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw error;
  return CollectionSchema.parse(data);
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id).eq('is_system', false);
  if (error) throw error;
}

export async function listCollectionItems(collectionId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('items(*)')
    .eq('collection_id', collectionId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return z.array(ItemSchema).parse(data.map((row) => row.items));
}

/** Collection ids the item belongs to. */
export async function listItemCollectionIds(itemId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('collection_id')
    .eq('item_id', itemId);
  if (error) throw error;
  return data.map((row) => row.collection_id);
}

export async function addItemToCollection(collectionId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, item_id: itemId });
  if (error) throw error;
}

export async function removeItemFromCollection(
  collectionId: string,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('item_id', itemId);
  if (error) throw error;
}
