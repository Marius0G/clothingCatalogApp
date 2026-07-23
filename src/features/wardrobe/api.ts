import {
  ItemSchema,
  ItemTagsSchema,
  type Item,
  type ItemStatus,
  type ItemTags,
  type ItemUpdate,
} from '@shared/types';
import * as FileSystem from 'expo-file-system/legacy';
import { z } from 'zod';

// Feature→feature dependency, deliberate: local-ai is infrastructure the data
// layer branches on, so the cloud/local split stays invisible to callers.
import {
  ensureLocalAiSynced,
  isLocalAiAvailable,
  localSuggestTags,
} from '@/features/local-ai/api';
import i18n from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const tagLocale = () => (i18n.language === 'ro' ? 'ro' : 'en');

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
  brand?: string | null;
  category?: Item['category'];
  subcategory?: string | null;
  colors?: string[];
  style_tags?: string[];
  notes?: string | null;
  ai_tagged?: boolean;
  // v2 attributes (AI-extracted; see ItemTags)
  pattern?: Item['pattern'];
  material?: Item['material'];
  fit?: Item['fit'];
  formality?: number | null;
  warmth?: number | null;
  seasons?: string[];
  occasions?: string[];
  layer?: Item['layer'];
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

/**
 * On-device variant of the tag-item edge function's item_id path: downloads
 * the photo, tags it locally, applies the same fill-only-empty merge for the
 * free-text fields. Null on any failure — caller falls through to the cloud.
 */
async function tagItemLocally(itemId: string): Promise<Item | null> {
  const item = await getItem(itemId);
  if (!item.image_path) return null;
  const signedUrl = await getSignedImageUrl(item.image_path);
  const localUri = `${FileSystem.cacheDirectory}tag-${itemId}.jpg`;
  await FileSystem.downloadAsync(signedUrl, localUri);
  try {
    const tags = await localSuggestTags(localUri, tagLocale());
    if (!tags) return null;
    return await updateItem(itemId, {
      title: item.title || tags.title,
      brand: item.brand || tags.brand,
      notes: item.notes || tags.description,
      category: tags.category,
      subcategory: tags.subcategory,
      colors: tags.colors,
      style_tags: tags.style_tags,
      pattern: tags.pattern,
      material: tags.material,
      fit: tags.fit,
      formality: tags.formality,
      warmth: tags.warmth,
      seasons: tags.seasons,
      occasions: tags.occasions,
      layer: tags.layer,
      ai_tagged: true,
    });
  } finally {
    FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
  }
}

/** Fire-and-forget vision auto-tagging; returns null if AI is unavailable. */
export async function requestAutoTags(itemId: string): Promise<Item | null> {
  await ensureLocalAiSynced();
  if (isLocalAiAvailable()) {
    const item = await tagItemLocally(itemId).catch(() => null);
    if (item) return item;
  }
  const { data, error } = await supabase.functions.invoke('tag-item', {
    body: { item_id: itemId },
  });
  if (error) return null;
  return ItemSchema.parse(data.item);
}

/**
 * Vision tag suggestions for a photo that isn't saved yet (add-item screen).
 * Returns null when AI is unavailable — the caller degrades to post-save tagging.
 */
export async function suggestTags(image: {
  uri: string;
  base64: string;
}): Promise<ItemTags | null> {
  await ensureLocalAiSynced();
  if (isLocalAiAvailable()) {
    const tags = await localSuggestTags(image.uri, tagLocale());
    if (tags) return tags;
  }
  const { data, error } = await supabase.functions.invoke('tag-item', {
    body: { image_base64: image.base64, mime: 'image/jpeg' },
  });
  if (error) return null;
  const parsed = ItemTagsSchema.safeParse(data?.tags);
  return parsed.success ? parsed.data : null;
}
