/**
 * Prompt builders shared between edge functions and the app's on-device AI
 * path. Canonical location is under supabase/functions/_shared so edge deploys
 * bundle it; the app imports it via the root shared/prompts.ts re-export.
 * Keep dependency-free except zod (via ./types.ts). Cloud and local inference
 * MUST use the same prompt so quality evals transfer between them.
 */
import {
  CanonicalColorSchema,
  ItemCategorySchema,
  ItemFitSchema,
  ItemLayerSchema,
  ItemMaterialSchema,
  ItemPatternSchema,
  OccasionSchema,
  SeasonSchema,
  StyleTagSchema,
} from './types.ts';

// Style tags are canonical English (engine vocabulary); UI shows them as-is.
const STYLE_VOCAB = StyleTagSchema.options.join(', ');

export function buildTagItemPrompt(locale: string): string {
  const lang = locale === 'ro' ? 'Romanian' : 'English';
  return [
    'You are a fashion cataloguing assistant. Look at the photo of a single clothing item and return ONLY a JSON object, no prose, with exactly these keys:',
    `- "title": a short catalogue name for the item in ${lang}, max 6 words (e.g. "Tricou alb oversized")`,
    '- "brand": the brand name ONLY if a logo or label is clearly identifiable in the photo, otherwise null. Never guess.',
    '- "category": one of "top","bottom","dress","outerwear","shoes","accessory" (always these exact English values). Hoodies, sweatshirts, sweaters and cardigans are "top" (never "outerwear"), whether zip-up or pullover; "outerwear" is ONLY jackets, coats, blazers, parkas and gilets worn over a top.',
    `- "subcategory": the specific garment type (e.g. t-shirt, jeans, sneakers), in ${lang}, lowercase`,
    `- "colors": array of 1-4 dominant colors of the garment, exactly from: ${CanonicalColorSchema.options.join(', ')}`,
    `- "style_tags": array of 2-4 style descriptors, chosen ONLY from this exact list, no other words: ${STYLE_VOCAB}`,
    `- "pattern": one of ${ItemPatternSchema.options.map((v) => `"${v}"`).join(',')}`,
    `- "material": the main visible/likely material, one of ${ItemMaterialSchema.options.map((v) => `"${v}"`).join(',')}`,
    `- "fit": one of ${ItemFitSchema.options.map((v) => `"${v}"`).join(',')}, or null for shoes/accessories`,
    '- "formality": integer 1-5 (1=gym/lounge, 2=casual, 3=smart casual, 4=business, 5=formal)',
    '- "warmth": integer 1-5 (1=hot-weather piece, 3=mid-season, 5=heavy winter)',
    '- "seasons": array of suitable seasons from "spring","summer","autumn","winter"',
    `- "occasions": array of 1-4 typical wearing occasions from: ${OccasionSchema.options.join(', ')}`,
    '- "layer": how it layers on the torso — "base" (t-shirts, shirts, dresses), "mid" (sweaters, hoodies, cardigans), "outer" (jackets, coats), "none" (bottoms, shoes, accessories)',
    `- "description": 1-2 short sentences in ${lang} describing the garment (cut, material if visible, what it pairs well with)`,
    'All attribute values must be the exact English tokens listed above; only title, subcategory and description are localized.',
    `For the localized fields (title, subcategory, description) use correct, natural ${lang} garment vocabulary; never invent words or borrow from another language.`,
    'Ignore the background and any person wearing the item; describe the garment itself.',
  ].join('\n');
}

/**
 * Strict JSON Schema mirror of ItemTagsSchema's *input* shape, for
 * grammar-constrained decoding (llama.cpp `response_format: json_schema`).
 * Hand-built from the zod enums' .options so vocabulary can never drift —
 * ItemTagsSchema itself is wrapped in preprocess/transform/catch layers that
 * make a derived schema unusable. Grammar guarantees syntax and vocabulary;
 * the lenient ItemTagsSchema parse (+ reconcileTags) remains the final word.
 */
export const ITEM_TAGS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 80 },
    brand: { anyOf: [{ type: 'string', minLength: 1, maxLength: 60 }, { type: 'null' }] },
    category: { enum: [...ItemCategorySchema.options] },
    subcategory: { type: 'string', minLength: 1, maxLength: 40 },
    colors: {
      type: 'array',
      items: { enum: [...CanonicalColorSchema.options] },
      minItems: 1,
      maxItems: 4,
    },
    style_tags: {
      type: 'array',
      items: { enum: [...StyleTagSchema.options] },
      minItems: 2,
      maxItems: 4,
    },
    pattern: { enum: [...ItemPatternSchema.options] },
    material: { enum: [...ItemMaterialSchema.options] },
    fit: { anyOf: [{ enum: [...ItemFitSchema.options] }, { type: 'null' }] },
    formality: { type: 'integer', minimum: 1, maximum: 5 },
    warmth: { type: 'integer', minimum: 1, maximum: 5 },
    seasons: {
      type: 'array',
      items: { enum: [...SeasonSchema.options] },
      minItems: 1,
      maxItems: 4,
    },
    occasions: {
      type: 'array',
      items: { enum: [...OccasionSchema.options] },
      minItems: 1,
      maxItems: 4,
    },
    layer: { enum: [...ItemLayerSchema.options] },
    description: { type: 'string', minLength: 1, maxLength: 400 },
  },
  required: [
    'title', 'brand', 'category', 'subcategory', 'colors', 'style_tags',
    'pattern', 'material', 'fit', 'formality', 'warmth', 'seasons',
    'occasions', 'layer', 'description',
  ],
  additionalProperties: false,
} as const;

const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

/**
 * Grammar mirror of OutfitRecsSchema for the on-device path. The pattern
 * forces UUID-shaped ids; the rule scorer still rejects ids that aren't in
 * the wardrobe.
 */
export const OUTFIT_RECS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    outfits: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          item_ids: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: { type: 'string', pattern: UUID_PATTERN },
          },
          occasion: { type: 'string', minLength: 1 },
          rationale: { type: 'string', minLength: 1 },
        },
        required: ['item_ids', 'occasion', 'rationale'],
        additionalProperties: false,
      },
    },
  },
  required: ['outfits'],
  additionalProperties: false,
} as const;

/** Grammar mirror of PurchaseRecsSchema for the on-device path. */
export const PURCHASE_RECS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          catalog_product_id: { type: 'string', pattern: UUID_PATTERN },
          rationale: { type: 'string', minLength: 1 },
        },
        required: ['catalog_product_id', 'rationale'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
} as const;

export const PURCHASE_SUGGESTION_COUNT = 6;

export type PurchaseWardrobeItem = {
  title: string | null;
  category: string | null;
  subcategory: string | null;
  colors: string[];
  style_tags: string[];
  brand: string | null;
  formality: number | null;
  material: string | null;
  occasions: string[];
};

export type PurchaseCandidate = {
  id: string;
  title: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
};

export function buildPurchasePrompt(
  locale: string,
  wardrobe: PurchaseWardrobeItem[],
  candidates: PurchaseCandidate[],
  preferences: string | null,
  noGo: string | null,
): string {
  const lang = locale === 'ro' ? 'Romanian' : 'English';
  return [
    `You are a personal stylist. From the candidate products below, pick the ${PURCHASE_SUGGESTION_COUNT} that best complete this user's wardrobe — fill gaps, match their colors and style. Avoid near-duplicates of what they already own.`,
    `Return ONLY JSON: {"suggestions":[{"catalog_product_id":"<id from candidates>","rationale":"one sentence in ${lang} explaining the match"}]}`,
    preferences ? `User preferences: ${preferences}` : '',
    noGo ? `The user NEVER wears (hard exclusions): ${noGo}` : '',
    'Wardrobe summary (JSON):',
    JSON.stringify(wardrobe),
    'Candidate products (JSON):',
    JSON.stringify(candidates),
  ]
    .filter(Boolean)
    .join('\n');
}
