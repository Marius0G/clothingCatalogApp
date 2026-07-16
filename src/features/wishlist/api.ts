import {
  ItemSchema,
  TrackedProductSchema,
  type Item,
  type TrackedProduct,
} from '@shared/types';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  'Accept-Language': 'ro,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml',
};

export type WishlistEntry = Item & { tracked_product: TrackedProduct | null };

const WishlistRowSchema = ItemSchema.extend({
  tracked_products: z
    .union([TrackedProductSchema, z.array(TrackedProductSchema)])
    .nullable(),
});

export async function listWishlist(userId: string): Promise<WishlistEntry[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*, tracked_products(*)')
    .eq('user_id', userId)
    .eq('status', 'wishlist')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return z
    .array(WishlistRowSchema)
    .parse(data)
    .map(({ tracked_products, ...item }) => ({
      ...item,
      tracked_product: Array.isArray(tracked_products)
        ? (tracked_products[0] ?? null)
        : tracked_products,
    }));
}

export async function getTrackedProduct(itemId: string): Promise<TrackedProduct | null> {
  const { data, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('item_id', itemId)
    .maybeSingle();
  if (error) throw error;
  return data ? TrackedProductSchema.parse(data) : null;
}

export class ImportFailed extends Error {
  constructor(public reason: 'invalid' | 'parse' | 'generic') {
    super(reason);
  }
}

/**
 * On-device HTML fetch (residential IP gets past shop anti-bot), parsing and
 * persistence server-side. Falls back to a server-side fetch when the device
 * fetch fails.
 */
export async function importFromLink(url: string): Promise<Item> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
  } catch {
    throw new ImportFailed('invalid');
  }

  let html: string | undefined;
  try {
    const res = await fetch(parsed.href, { headers: BROWSER_HEADERS });
    if (res.ok) {
      const text = await res.text();
      if (text.length >= 100) html = text;
    }
  } catch {
    // server-side fetch fallback below
  }

  const { data, error } = await supabase.functions.invoke('parse-product', {
    body: { url: parsed.href, html },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new ImportFailed(status === 422 ? 'parse' : 'generic');
  }
  return ItemSchema.parse(data.item);
}

/** Wishlist → wardrobe: flip status and leave the system Wishlist collection. */
export async function moveToWardrobe(userId: string, itemId: string): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .update({ status: 'wardrobe' })
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;

  const { data: wishlistCollection } = await supabase
    .from('collections')
    .select('id')
    .eq('user_id', userId)
    .eq('is_system', true)
    .single();
  if (wishlistCollection) {
    await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', wishlistCollection.id)
      .eq('item_id', itemId);
  }
  return ItemSchema.parse(data);
}
