/**
 * Outfit-generation eval: builds a synthetic 80-item wardrobe from the cloud
 * tagging baseline (tag_results.json), then runs the PRODUCTION outfit
 * pipeline (shared prefilter → compose prompt → rule scorer) against either a
 * local llama.cpp server (Gemma) or the cloud Featherless text model, across a
 * fixed set of occasion/weather scenarios. Reports validity, hallucinated-id
 * rejects, rule scores, and latency.
 *
 * Local:  npx deno run -A --config supabase/functions/deno.json scripts/eval-local-outfits.ts --backend http://127.0.0.1:8091 --label e2b
 * Cloud:  npx deno run -A --config supabase/functions/deno.json scripts/eval-local-outfits.ts --backend cloud --label cloud
 *
 * Uses only node:-prefixed APIs so the app's tsc also type-checks this file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
import { OUTFIT_RECS_JSON_SCHEMA } from '../supabase/functions/_shared/prompts.ts';
import { OutfitRecsSchema, type ItemTags } from '../supabase/functions/_shared/types.ts';

const GALLERY = 'C:/Users/mariu/Pictures/clothing-test-gallery';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const backend = arg('backend', 'http://127.0.0.1:8091');
const label = arg('label', 'local');
const isCloud = backend === 'cloud';

// ---------- wardrobe from the tagging baseline ----------

interface BaselineEntry {
  file: string;
  expected: string;
  tags: ItemTags | null;
}

const baseline: BaselineEntry[] = JSON.parse(
  readFileSync(join(GALLERY, 'tag_results.json'), 'utf-8'),
);

const uuidOf = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const fileById = new Map<string, string>();
const wardrobe: CompactItem[] = baseline
  .filter((entry) => entry.tags)
  .map((entry, index) => {
    const id = uuidOf(index);
    fileById.set(id, entry.file);
    const tags = entry.tags!;
    return {
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
    };
  });

const SCENARIOS: { name: string; ctx: OutfitContext }[] = [
  { name: 'free', ctx: { occasion: null, weather: null, anchorItemId: null } },
  { name: 'everyday-mild', ctx: { occasion: 'everyday', weather: 'mild', anchorItemId: null } },
  { name: 'office-cold', ctx: { occasion: 'office', weather: 'cold', anchorItemId: null } },
  { name: 'evening-mild', ctx: { occasion: 'evening', weather: 'mild', anchorItemId: null } },
  { name: 'sport-hot', ctx: { occasion: 'sport', weather: 'hot', anchorItemId: null } },
];

// ---------- backends ----------

const extractJson = (text: string) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(text.slice(start, end + 1));
};

function loadFeatherlessEnv(): { key: string; model: string; base: string } {
  const env = readFileSync('supabase/functions/.env', 'utf-8');
  const get = (name: string) => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();
  const key = get('FEATHERLESS_API_KEY');
  if (!key) throw new Error('FEATHERLESS_API_KEY not found in supabase/functions/.env');
  return {
    key,
    model: get('TEXT_MODEL') ?? 'Qwen/Qwen2.5-72B-Instruct',
    base: get('FEATHERLESS_BASE_URL') ?? 'https://api.featherless.ai/v1',
  };
}

async function complete(prompt: string): Promise<string> {
  if (isCloud) {
    const { key, model, base } = loadFeatherlessEnv();
    // Mirror _shared/featherless.ts: retry transient failures with 4s/9s waits.
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        // Featherless queues heavily under concurrency pressure; without a
        // deadline a stalled request hangs the whole eval.
        signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1400,
          temperature: 0.6,
        }),
        });
      } catch (error) {
        if (attempt >= 2) throw error; // timeout/network — treat as transient
        await new Promise((resolve) => setTimeout(resolve, [4000, 9000][attempt] ?? 9000));
        continue;
      }
      const text = await response.text();
      const transient =
        response.status === 429 || response.status === 503 || text.includes('oncurrency');
      if (response.ok) return JSON.parse(text).choices[0].message.content;
      if (!transient || attempt >= 2) throw new Error(`featherless ${response.status}: ${text.slice(0, 200)}`);
      await new Promise((resolve) => setTimeout(resolve, [4000, 9000][attempt] ?? 9000));
    }
  }
  const response = await fetch(`${backend}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1400,
      temperature: 0.6,
      chat_template_kwargs: { enable_thinking: false },
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'outfits', strict: true, schema: OUTFIT_RECS_JSON_SCHEMA },
      },
    }),
  });
  if (!response.ok) throw new Error(`llama-server ${response.status}: ${await response.text()}`);
  return (await response.json()).choices[0].message.content;
}

// ---------- run ----------

interface ScenarioResult {
  scenario: string;
  parsed: boolean;
  attempts: number;
  candidates: number;
  outfitsReturned: number;
  rejects: string[];
  scoredCount: number;
  acceptedCount: number;
  meanScore: number | null;
  maxScore: number | null;
  minAcceptedMet: boolean;
  ms: number;
  sampleOutfits: { files: string[]; occasion: string; rationale: string; score: number | null }[];
}

const results: ScenarioResult[] = [];

for (const scenario of SCENARIOS) {
  const candidates = filterCandidates(wardrobe, scenario.ctx);
  const itemsById = new Map(candidates.map((item) => [item.id, item]));
  const prompt = buildOutfitPrompt('ro', candidates, null, null, scenario.ctx, []);

  const started = Date.now();
  let attempts = 0;
  let parsedOk = false;
  let evaluated: ReturnType<typeof evaluateOutfits> | null = null;
  let problems: string[] = [];
  let outfitsReturned = 0;

  // Mirror the edge fn: up to 2 attempts, feeding back rejection reasons.
  for (; attempts < 2; attempts++) {
    const fullPrompt =
      attempts === 0
        ? prompt
        : `${prompt}\nYour previous reply was rejected: ${
            problems.join('; ') || 'it was not a valid JSON object matching the schema'
          }. Fix these issues and return ONLY the JSON object with valid provided ids.`;
    try {
      const content = await complete(fullPrompt);
      const parsed = OutfitRecsSchema.parse(extractJson(content));
      parsedOk = true;
      outfitsReturned = parsed.outfits.length;
      evaluated = evaluateOutfits(parsed, itemsById, scenario.ctx);
      problems = evaluated.problems;
      if (evaluated.accepted.length >= MIN_ACCEPTED) break;
    } catch (error) {
      problems = [String(error).slice(0, 120)];
    }
  }
  const ms = Date.now() - started;

  const scores = evaluated?.scores ?? [];
  const scoreOf = new Map<string, number>();
  // evaluateOutfits doesn't map scores back to outfits; recompute for samples.
  const accepted = evaluated?.accepted ?? [];
  results.push({
    scenario: scenario.name,
    parsed: parsedOk,
    attempts,
    candidates: candidates.length,
    outfitsReturned,
    rejects: (evaluated?.problems ?? problems).filter((p) => p.startsWith('an outfit')),
    scoredCount: scores.length,
    acceptedCount: accepted.length,
    meanScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    maxScore: scores.length ? Math.max(...scores) : null,
    minAcceptedMet: accepted.length >= MIN_ACCEPTED,
    ms,
    sampleOutfits: accepted.slice(0, 2).map((outfit) => ({
      files: outfit.item_ids.map((id) => fileById.get(id) ?? id),
      occasion: outfit.occasion,
      rationale: outfit.rationale,
      score: scoreOf.get(outfit.item_ids.join()) ?? null,
    })),
  });
  console.log(
    `[${scenario.name}] parsed=${parsedOk} outfits=${outfitsReturned} accepted=${
      results.at(-1)!.acceptedCount
    } rejects=${results.at(-1)!.rejects.length} mean=${results.at(-1)!.meanScore?.toFixed(1)} ${(ms / 1000).toFixed(1)}s`,
  );
}

writeFileSync(join(GALLERY, `outfit_eval_${label}.json`), JSON.stringify(results, null, 2));

const parsedAll = results.filter((r) => r.parsed);
const totalRejects = results.reduce((a, r) => a + r.rejects.length, 0);
const totalScored = results.reduce((a, r) => a + r.scoredCount, 0);
const means = results.map((r) => r.meanScore).filter((m): m is number => m != null);
console.log(`\n=== ${label} outfit eval ===`);
console.log(`scenarios parsed:      ${parsedAll.length}/${results.length}`);
console.log(`MIN_ACCEPTED met:      ${results.filter((r) => r.minAcceptedMet).length}/${results.length}`);
console.log(`outfit rejects:        ${totalRejects} (of ${totalScored + totalRejects} outfits)`);
console.log(`mean rule score:       ${means.length ? (means.reduce((a, b) => a + b, 0) / means.length).toFixed(2) : 'n/a'}`);
console.log(`retry (2nd attempt):   ${results.filter((r) => r.attempts > 1).length}/${results.length}`);
console.log(`latency s per scenario: ${results.map((r) => (r.ms / 1000).toFixed(1)).join(', ')}`);
