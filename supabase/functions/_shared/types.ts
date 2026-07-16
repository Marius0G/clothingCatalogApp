/**
 * Contracts shared between the Expo app and Supabase Edge Functions.
 * Canonical location is under supabase/functions/_shared so edge deploys
 * bundle it; the app imports it via the root shared/types.ts re-export.
 * Keep dependency-free except zod. Every LLM output MUST be validated here.
 */
import { z } from 'zod';

// ---------- profile ----------

export const SizesSchema = z
  .object({
    top: z.string(),
    bottom: z.string(),
    shoe: z.string(),
  })
  .partial();

export const SexSchema = z.enum(['male', 'female', 'other']);
export const LocaleSchema = z.enum(['ro', 'en']);

export const ProfileSchema = z.object({
  id: z.uuid(),
  nickname: z.string().nullable(),
  sex: SexSchema.nullable(),
  birth_year: z.number().int().min(1900).max(2100).nullable(),
  sizes: SizesSchema,
  style_preferences: z.string().nullable(),
  locale: LocaleSchema,
  onboarded_at: z.string().nullable(),
  created_at: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileUpdateSchema = ProfileSchema.omit({
  id: true,
  created_at: true,
}).partial();
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

// ---------- items ----------

export const ItemCategorySchema = z.enum([
  'top',
  'bottom',
  'dress',
  'outerwear',
  'shoes',
  'accessory',
]);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

export const ItemStatusSchema = z.enum(['wishlist', 'wardrobe']);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

export const ItemSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  status: ItemStatusSchema,
  source: z.enum(['photo', 'link']),
  title: z.string().nullable(),
  brand: z.string().nullable(),
  category: ItemCategorySchema.nullable(),
  subcategory: z.string().nullable(),
  colors: z.array(z.string()),
  style_tags: z.array(z.string()),
  ai_tagged: z.boolean(),
  image_path: z.string().nullable(),
  original_image_path: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Item = z.infer<typeof ItemSchema>;

export const ItemUpdateSchema = ItemSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
}).partial();
export type ItemUpdate = z.infer<typeof ItemUpdateSchema>;

// ---------- collections ----------

export const CollectionSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string(),
  is_system: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.string(),
});
export type Collection = z.infer<typeof CollectionSchema>;

// ---------- AI contracts ----------

/** Contract for the tag-item edge function (vision auto-tagging, M1). */
export const ItemTagsSchema = z.object({
  category: ItemCategorySchema,
  subcategory: z.string(),
  colors: z.array(z.string()).max(4),
  style_tags: z.array(z.string()).max(6),
});
export type ItemTags = z.infer<typeof ItemTagsSchema>;

// ---------- tracked products (M2) ----------

export const TrackedProductSchema = z.object({
  id: z.uuid(),
  item_id: z.uuid(),
  user_id: z.uuid(),
  url: z.string(),
  canonical_url: z.string().nullable(),
  store: z.enum(['zara', 'bershka', 'hm', 'vinted', 'generic']),
  external_id: z.string().nullable(),
  currency: z.string().nullable(),
  current_price: z.number().nullable(),
  original_price: z.number().nullable(),
  sizes_available: z
    .array(z.object({ size: z.string(), in_stock: z.boolean() }))
    .nullable(),
  in_stock: z.boolean().nullable(),
  parse_method: z.enum(['dedicated', 'og', 'llm']).nullable(),
  fetch_strategy: z.enum(['server', 'client']),
  last_checked_at: z.string().nullable(),
  check_failures: z.number().int(),
  stale: z.boolean(),
  created_at: z.string(),
});
export type TrackedProduct = z.infer<typeof TrackedProductSchema>;

// ---------- product parsing (M2) ----------

export const StoreSchema = z.enum(['zara', 'bershka', 'hm', 'vinted', 'generic']);
export const ParseMethodSchema = z.enum(['dedicated', 'og', 'llm']);

export const SizeAvailabilitySchema = z.object({
  size: z.string(),
  in_stock: z.boolean(),
});

/** Contract for the parse-product edge function. */
export const ParsedProductSchema = z.object({
  title: z.string().min(1),
  brand: z.string().nullable(),
  image_url: z.url().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: z.string().nullable(),
  sizes_available: z.array(SizeAvailabilitySchema).nullable(),
  in_stock: z.boolean().nullable(),
  colors: z.array(z.string()).nullable(),
  canonical_url: z.url().nullable(),
  external_id: z.string().nullable(),
  store: StoreSchema,
  parse_method: ParseMethodSchema,
});
export type ParsedProduct = z.infer<typeof ParsedProductSchema>;
