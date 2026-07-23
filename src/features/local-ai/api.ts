/**
 * On-device AI with the same contracts as the edge functions: identical
 * prompts (@shared/prompts), grammar-constrained JSON output, same zod
 * validation, same retry/evaluate flow. Callers treat null as "AI
 * unavailable" and fall back to the cloud path, mirroring the existing
 * degradation behavior.
 */
import {
  buildOutfitPrompt,
  evaluateOutfits,
  filterCandidates,
  MIN_ACCEPTED,
  type CompactItem,
  type OutfitContext,
} from '@shared/outfitEngine';
import {
  buildPurchasePrompt,
  buildTagItemPrompt,
  ITEM_TAGS_JSON_SCHEMA,
  OUTFIT_RECS_JSON_SCHEMA,
  PURCHASE_RECS_JSON_SCHEMA,
  type PurchaseCandidate,
  type PurchaseWardrobeItem,
} from '@shared/prompts';
import {
  ItemTagsSchema,
  OutfitRecsSchema,
  PurchaseRecsSchema,
  type ItemTags,
  type OutfitRecs,
  type PurchaseRecs,
} from '@shared/types';
import { Platform } from 'react-native';

import { syncDownloadStates } from './downloads';
import { withEngine } from './engine';
import { useLocalAiStore } from './store';

// Tighter than the edge fn's 60: keeps the compose prompt inside the
// on-device n_ctx (8192) with room for the 1400-token reply.
const LOCAL_MAX_CANDIDATES = 40;

/**
 * True when the user chose local mode and the active model is fully on disk.
 * Call ensureLocalAiSynced() first on cold paths — before the disk sync runs,
 * this conservatively reports false and callers use the cloud.
 */
export function isLocalAiAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  const { mode, activeModelId, downloads } = useLocalAiStore.getState();
  return (
    mode === 'local' &&
    activeModelId !== null &&
    downloads[activeModelId]?.status === 'done'
  );
}

export function ensureLocalAiSynced(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  return syncDownloadStates();
}

export async function localSuggestTags(
  imageUri: string,
  locale: string,
): Promise<ItemTags | null> {
  const modelId = useLocalAiStore.getState().activeModelId;
  if (!modelId) return null;
  try {
    return await withEngine(modelId, async (context) => {
      let tags: ItemTags | null = null;
      for (let attempt = 0; attempt < 2 && !tags; attempt++) {
        const prompt =
          attempt === 0
            ? buildTagItemPrompt(locale)
            : buildTagItemPrompt(locale) +
              '\nYour previous reply was not valid JSON matching the schema. Return ONLY the JSON object.';
        const result = await context.completion({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUri } },
              ],
            },
          ],
          n_predict: 800,
          temperature: 0.2,
          jinja: true,
          // Gemma 4 is a thinking model; without this the JSON grammar fights
          // the think prelude and the answer lands in reasoning_content.
          chat_template_kwargs: { enable_thinking: false },
          response_format: {
            type: 'json_schema',
            json_schema: { strict: true, schema: ITEM_TAGS_JSON_SCHEMA },
          },
        });
        try {
          tags = ItemTagsSchema.parse(JSON.parse(result.content || result.text));
        } catch {
          tags = null;
        }
      }
      return tags;
    });
  } catch {
    return null;
  }
}

/** One grammar-constrained text completion on the active local model. */
async function localTextCompletion(
  prompt: string,
  schema: object,
  options: { maxTokens: number; temperature: number },
): Promise<string | null> {
  const modelId = useLocalAiStore.getState().activeModelId;
  if (!modelId) return null;
  try {
    return await withEngine(modelId, async (context) => {
      const result = await context.completion({
        messages: [{ role: 'user', content: prompt }],
        n_predict: options.maxTokens,
        temperature: options.temperature,
        jinja: true,
        chat_template_kwargs: { enable_thinking: false },
        response_format: { type: 'json_schema', json_schema: { strict: true, schema } },
      });
      return result.content || result.text;
    });
  } catch {
    return null;
  }
}

/**
 * On-device variant of the recommend-outfits compose+score pipeline. Inputs
 * mirror what the edge fn assembles server-side; the caller fetches them
 * under RLS. Null on failure — caller falls back to the cloud function.
 */
export async function localOutfitRecs(
  wardrobe: CompactItem[],
  ctx: OutfitContext,
  preferences: string | null,
  noGo: string | null,
  signals: string[],
  locale: string,
): Promise<OutfitRecs | null> {
  let candidates = filterCandidates(wardrobe, ctx);
  if (candidates.length > LOCAL_MAX_CANDIDATES) {
    const newest = candidates.slice(-LOCAL_MAX_CANDIDATES);
    const anchor = candidates.find((item) => item.id === ctx.anchorItemId);
    candidates = anchor && !newest.includes(anchor) ? [anchor, ...newest.slice(1)] : newest;
  }
  const itemsById = new Map(candidates.map((item) => [item.id, item]));
  const prompt = buildOutfitPrompt(locale, candidates, preferences, noGo, ctx, signals);

  let fallback: OutfitRecs['outfits'] = [];
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await localTextCompletion(
      attempt === 0
        ? prompt
        : `${prompt}\nYour previous reply was rejected: ${
            problems.join('; ') || 'it was not a valid JSON object matching the schema'
          }. Fix these issues and return ONLY the JSON object with valid provided ids.`,
      OUTFIT_RECS_JSON_SCHEMA,
      { maxTokens: 1400, temperature: 0.6 },
    );
    if (content === null) return null;
    try {
      const parsed = OutfitRecsSchema.parse(JSON.parse(content));
      const evaluated = evaluateOutfits(parsed, itemsById, ctx);
      problems = evaluated.problems;
      if (evaluated.anyValid.length > fallback.length) fallback = evaluated.anyValid;
      if (evaluated.accepted.length >= MIN_ACCEPTED) return { outfits: evaluated.accepted };
    } catch {
      problems = [];
    }
  }
  return fallback.length > 0 ? { outfits: fallback } : null;
}

/**
 * On-device variant of recommend-purchases: pick catalog products that
 * complete the wardrobe. Null on failure — caller falls back to the cloud.
 */
export async function localPurchaseRecs(
  wardrobe: PurchaseWardrobeItem[],
  candidates: PurchaseCandidate[],
  preferences: string | null,
  noGo: string | null,
  locale: string,
): Promise<PurchaseRecs | null> {
  const prompt = buildPurchasePrompt(locale, wardrobe, candidates, preferences, noGo);
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await localTextCompletion(
      attempt === 0
        ? prompt
        : prompt + '\nYour previous reply was invalid. Use only ids from the candidates list.',
      PURCHASE_RECS_JSON_SCHEMA,
      { maxTokens: 700, temperature: 0.5 },
    );
    if (content === null) return null;
    try {
      const parsed = PurchaseRecsSchema.parse(JSON.parse(content));
      if (parsed.suggestions.every((s) => candidateIds.has(s.catalog_product_id))) {
        return parsed;
      }
    } catch {
      // retry with the nudge
    }
  }
  return null;
}
