import {
  ItemSchema,
  type Item,
  type ItemStatus,
  type ItemUpdate,
} from '@shared/types';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

const BUCKET = 'item-photos';

export async function listItems(userId: string, status: ItemStatus): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return z.array(ItemSchema).parse(data);
}

export async function getItem(id: string): Promise<Item> {
  const { data, error } = await supabase.from('items').select('*').eq('id', id).single();
  if (error) throw error;
  return ItemSchema.parse(data);
}

export type NewPhotoItem = {
  title: string | null;
  status: ItemStatus;
};

export async function createPhotoItem(userId: string, input: NewPhotoItem): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({ user_id: userId, source: 'photo', ...input })
    .select()
    .single();
  if (error) throw error;
  return ItemSchema.parse(data);
}

export async function updateItem(id: string, update: ItemUpdate): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return ItemSchema.parse(data);
}

export async function deleteItem(item: Item): Promise<void> {
  const paths = [item.image_path, item.original_image_path].filter(
    (p): p is string => !!p,
  );
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
  const { error } = await supabase.from('items').delete().eq('id', item.id);
  if (error) throw error;
}

/** Uploads a local image (file:// uri) and returns its storage path. */
export async function uploadItemImage(
  userId: string,
  itemId: string,
  localUri: string,
  kind: 'main' | 'original',
  isPng: boolean, // cutouts are PNG (transparency); originals JPEG
): Promise<string> {
  const path = `${userId}/${itemId}/${kind}.${isPng ? 'png' : 'jpg'}`;
  const body = await fetch(localUri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: isPng ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function getSignedImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Fire-and-forget vision auto-tagging; returns null if AI is unavailable. */
export async function requestAutoTags(itemId: string): Promise<Item | null> {
  const { data, error } = await supabase.functions.invoke('tag-item', {
    body: { item_id: itemId },
  });
  if (error) return null;
  return ItemSchema.parse(data.item);
}
