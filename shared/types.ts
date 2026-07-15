/**
 * Contracts shared between the Expo app and Supabase Edge Functions.
 * Keep this file dependency-free except zod — it is imported from Deno too.
 * Every LLM output MUST be validated against a schema from this file.
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

/** Contract for the tag-item edge function (vision auto-tagging, M1). */
export const ItemTagsSchema = z.object({
  category: ItemCategorySchema,
  subcategory: z.string(),
  colors: z.array(z.string()).max(4),
  style_tags: z.array(z.string()).max(6),
});
export type ItemTags = z.infer<typeof ItemTagsSchema>;

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
