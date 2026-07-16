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
  no_go: z.string().nullable(),
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

// Structured attributes (outfit engine v2). Values are canonical English —
// they are the vocabulary the recommender filters/scores on; the UI localizes
// them at display time. Must stay in sync with the checks in migration 0003.

export const CanonicalColorSchema = z.enum([
  'black', 'white', 'cream', 'beige', 'tan', 'brown', 'grey', 'silver', 'gold',
  'navy', 'blue', 'light-blue', 'red', 'burgundy', 'pink', 'purple', 'green',
  'olive', 'yellow', 'orange', 'multicolor',
]);
export type CanonicalColor = z.infer<typeof CanonicalColorSchema>;

export const ItemPatternSchema = z.enum([
  'solid', 'stripe', 'check', 'floral', 'print', 'melange', 'denim', 'other',
]);
export const ItemMaterialSchema = z.enum([
  'cotton', 'denim', 'wool', 'knit', 'linen', 'leather', 'suede', 'silk',
  'synthetic', 'fleece', 'other',
]);
export const ItemFitSchema = z.enum([
  'slim', 'regular', 'relaxed', 'oversized', 'straight', 'wide',
]);
export const ItemLayerSchema = z.enum(['base', 'mid', 'outer', 'none']);
export const SeasonSchema = z.enum(['spring', 'summer', 'autumn', 'winter']);
export type Season = z.infer<typeof SeasonSchema>;
export const OccasionSchema = z.enum([
  'everyday', 'office', 'evening', 'sport', 'event', 'travel', 'beach', 'home',
]);
export type Occasion = z.infer<typeof OccasionSchema>;
export const WeatherSchema = z.enum(['hot', 'mild', 'cool', 'cold']);
export type Weather = z.infer<typeof WeatherSchema>;

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
  // v2 attributes — nullable/empty on rows tagged before migration 0003;
  // filled by tag-item (re-tag from the item screen backfills old pieces).
  pattern: ItemPatternSchema.nullable(),
  material: ItemMaterialSchema.nullable(),
  fit: ItemFitSchema.nullable(),
  formality: z.number().int().min(1).max(5).nullable(),
  warmth: z.number().int().min(1).max(5).nullable(),
  seasons: z.array(z.string()),
  occasions: z.array(z.string()),
  layer: ItemLayerSchema.nullable(),
  times_worn: z.number().int(),
  last_worn_at: z.string().nullable(),
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

/**
 * Lenient enum helpers for LLM output: lowercase/trim before matching, and
 * degrade gracefully (fallback scalar / filtered array) instead of failing the
 * whole parse over one stray value — a failed parse costs a full retry call.
 */
const lower = (value: unknown) =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

function lenientEnum<T extends z.ZodType<string>>(schema: T) {
  return z.preprocess(lower, schema);
}

function lenientEnumArray<T extends z.ZodType<string>>(
  schema: T,
  fallback: z.infer<T>[],
  max = 6,
) {
  return z.preprocess((value) => {
    const valid = (Array.isArray(value) ? value : [value])
      .map(lower)
      .filter((entry) => schema.safeParse(entry).success);
    const unique = [...new Set(valid)].slice(0, max);
    return unique.length ? unique : fallback;
  }, z.array(schema).min(1));
}

/** Contract for the tag-item edge function (vision auto-tagging, M1 + v2 attrs). */
export const ItemTagsSchema = z.object({
  title: z.string().max(80),
  brand: z.string().max(60).nullable(),
  category: ItemCategorySchema,
  subcategory: z.string(),
  colors: lenientEnumArray(CanonicalColorSchema, ['multicolor'], 4),
  style_tags: z.array(z.string()).max(6),
  pattern: lenientEnum(ItemPatternSchema).catch('other'),
  material: lenientEnum(ItemMaterialSchema).catch('other'),
  fit: lenientEnum(ItemFitSchema).nullable().catch(null),
  formality: z.coerce.number().int().min(1).max(5).catch(3),
  warmth: z.coerce.number().int().min(1).max(5).catch(3),
  seasons: lenientEnumArray(SeasonSchema, [...SeasonSchema.options]),
  occasions: lenientEnumArray(OccasionSchema, ['everyday']),
  layer: lenientEnum(ItemLayerSchema).catch('none'),
  description: z.string().max(400),
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

// ---------- alerts (M4) ----------

export const AlertSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  tracked_product_id: z.uuid(),
  kind: z.enum(['price_drop', 'restock']),
  threshold: z.number().nullable(),
  size: z.string().nullable(),
  active: z.boolean(),
  last_triggered_at: z.string().nullable(),
  created_at: z.string(),
});
export type Alert = z.infer<typeof AlertSchema>;

export const ProductSnapshotSchema = z.object({
  id: z.number(),
  tracked_product_id: z.uuid(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  in_stock: z.boolean().nullable(),
  captured_at: z.string(),
});
export type ProductSnapshot = z.infer<typeof ProductSnapshotSchema>;

// ---------- outfit recommendations (M5, engine v2) ----------

/** Request context the app sends to recommend-outfits. */
export const OutfitRequestSchema = z.object({
  regenerate: z.boolean().optional(),
  occasion: OccasionSchema.optional(),
  weather: WeatherSchema.optional(),
  anchor_item_id: z.uuid().optional(),
});
export type OutfitRequest = z.infer<typeof OutfitRequestSchema>;

/** Contract for the recommend-outfits edge function LLM output. */
export const OutfitSchema = z.object({
  item_ids: z.array(z.uuid()).min(2).max(6),
  occasion: z.string().min(1),
  rationale: z.string().min(1),
});
export type Outfit = z.infer<typeof OutfitSchema>;

// The LLM is asked for 6 candidates; the rule scorer returns the best few.
export const OutfitRecsSchema = z.object({
  outfits: z.array(OutfitSchema).min(1).max(6),
});
export type OutfitRecs = z.infer<typeof OutfitRecsSchema>;

/** A saved outfit row (outfits table); items live in outfit_items. */
export const SavedOutfitSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  title: z.string(),
  rationale: z.string().nullable(),
  occasion: z.string().nullable(),
  source: z.enum(['ai', 'manual']),
  created_at: z.string(),
});
export type SavedOutfit = z.infer<typeof SavedOutfitSchema>;

// ---------- purchase suggestions (M6) ----------

/** Contract for the recommend-purchases edge function LLM output. */
export const PurchasePickSchema = z.object({
  catalog_product_id: z.uuid(),
  rationale: z.string().min(1),
});
export const PurchaseRecsSchema = z.object({
  suggestions: z.array(PurchasePickSchema).min(1).max(8),
});
export type PurchaseRecs = z.infer<typeof PurchaseRecsSchema>;

export const CatalogProductSchema = z.object({
  id: z.uuid(),
  source: z.enum(['affiliate', 'scraped', 'organic']),
  network: z.string(),
  merchant: z.string().nullable(),
  url: z.string(),
  affiliate_url: z.string().nullable(),
  title: z.string(),
  brand: z.string().nullable(),
  image_url: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  category: z.string().nullable(),
});
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

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
