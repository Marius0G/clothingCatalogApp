/**
 * Whole-pipeline test of the on-device AI path against a local llama.cpp
 * server running the same Gemma weights the app ships: internet photos of
 * clothes → vision tagging (shared prompt + grammar + ItemTagsSchema) →
 * wardrobe → outfit compose (shared prompt + grammar + OutfitRecsSchema) →
 * shared rule scorer. Exercises exactly the shared modules the app's
 * src/features/local-ai/api.ts uses; only the transport differs (HTTP server
 * here, llama.rn context on the phone).
 *
 * Run:
 *   npx deno run -A --config supabase/functions/deno.json scripts/e2e-local-pipeline.ts \
 *     --server http://127.0.0.1:8091 --photos <dir>
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import {
  buildOutfitPrompt,
  evaluateOutfits,
  filterCandidates,
  MIN_ACCEPTED,
  type CompactItem,
  type OutfitContext,
} from '../supabase/functions/_shared/outfitEngine.ts';
import {
  buildTagItemPrompt,
  ITEM_TAGS_JSON_SCHEMA,
  OUTFIT_RECS_JSON_SCHEMA,
} from '../supabase/functions/_shared/prompts.ts';
import {
  ItemTagsSchema,
  OutfitRecsSchema,
  type ItemTags,
} from '../supabase/functions/_shared/types.ts';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const server = arg('server', 'http://127.0.0.1:8091');
const photosDir = arg('photos', '');
if (!photosDir) throw new Error('--photos <dir> required');

async function completion(body: object): Promise<string> {
  const response = await fetch(`${server}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      temperature: 0.2,
      chat_template_kwargs: { enable_thinking: false },
      ...body,
    }),
  });
  if (!response.ok) throw new Error(`llama-server ${response.status}: ${await response.text()}`);
  return (await response.json()).choices[0].message.content;
}

// ---------- stage 1: tag every photo (mirrors localSuggestTags) ----------

const photos = readdirSync(photosDir).filter((file) => /\.(jpe?g|png)$/i.test(file));
console.log(`— Stage 1: tagging ${photos.length} internet photos with the shared contract\n`);

const uuidOf = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const wardrobe: CompactItem[] = [];
const fileById = new Map<string, string>();

for (const [index, file] of photos.entries()) {
  const base64 = readFileSync(join(photosDir, file)).toString('base64');
  const started = Date.now();
  let tags: ItemTags | null = null;
  for (let attempt = 0; attempt < 2 && !tags; attempt++) {
    const prompt =
      attempt === 0
        ? buildTagItemPrompt('ro')
        : buildTagItemPrompt('ro') +
          '\nYour previous reply was not valid JSON matching the schema. Return ONLY the JSON object.';
    const content = await completion({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
      max_tokens: 800,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'item_tags', strict: true, schema: ITEM_TAGS_JSON_SCHEMA },
      },
    });
    try {
      tags = ItemTagsSchema.parse(JSON.parse(content));
    } catch {
      tags = null;
    }
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!tags) {
    console.log(`  ${file}: TAGGING FAILED (${seconds}s)`);
    continue;
  }
  const id = uuidOf(index);
  fileById.set(id, file);
  wardrobe.push({
    id,
    title: tags.title,
    category: tags.category,
    subcategory: tags.subcategory,
    colors: tags.colors,
    style_tags: tags.style_tags,
    brand: tags.brand,
    formality: tags.formality,
    warmth: tags.warmth,
    seasons: tags.seasons,
    occasions: tags.occasions,
    layer: tags.layer,
    material: tags.material,
    pattern: tags.pattern,
    times_worn: 0,
  });
  console.log(
    `  ${file}: "${tags.title}" — ${tags.category}/${tags.subcategory}, ${tags.colors.join('+')}, brand=${tags.brand ?? '—'}, formality=${tags.formality}, warmth=${tags.warmth} (${seconds}s)`,
  );
}

if (wardrobe.length < 4) throw new Error(`only ${wardrobe.length} items tagged — need ≥4 for outfits`);

// ---------- stage 2: compose outfits (mirrors localOutfitRecs) ----------

const SCENARIOS: { name: string; ctx: OutfitContext }[] = [
  { name: 'free', ctx: { occasion: null, weather: null, anchorItemId: null } },
  { name: 'everyday-mild', ctx: { occasion: 'everyday', weather: 'mild', anchorItemId: null } },
];

for (const scenario of SCENARIOS) {
  console.log(`\n— Stage 2: outfits for scenario "${scenario.name}"\n`);
  const candidates = filterCandidates(wardrobe, scenario.ctx);
  const itemsById = new Map(candidates.map((item) => [item.id, item]));
  const prompt = buildOutfitPrompt('ro', candidates, null, null, scenario.ctx, []);

  const started = Date.now();
  let accepted: ReturnType<typeof evaluateOutfits>['accepted'] = [];
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await completion({
      messages: [
        {
          role: 'user',
          content:
            attempt === 0
              ? prompt
              : `${prompt}\nYour previous reply was rejected: ${problems.join('; ')}. Fix these issues and return ONLY the JSON object with valid provided ids.`,
        },
      ],
      max_tokens: 1400,
      temperature: 0.6,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'outfits', strict: true, schema: OUTFIT_RECS_JSON_SCHEMA },
      },
    });
    try {
      const parsed = OutfitRecsSchema.parse(JSON.parse(content));
      const evaluated = evaluateOutfits(parsed, itemsById, scenario.ctx);
      problems = evaluated.problems;
      accepted = evaluated.accepted;
      if (accepted.length >= MIN_ACCEPTED) break;
    } catch (error) {
      problems = [String(error).slice(0, 100)];
    }
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ${accepted.length} outfits accepted by the rule scorer (${seconds}s):`);
  for (const outfit of accepted) {
    const files = outfit.item_ids.map((id) => fileById.get(id) ?? '??');
    console.log(`   • [${files.join(' + ')}] "${outfit.occasion}" — ${outfit.rationale}`);
  }
  if (problems.length) console.log(`  scorer notes: ${problems.join('; ')}`);
}

console.log('\nPIPELINE OK');
