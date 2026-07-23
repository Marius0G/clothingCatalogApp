/**
 * Local-model tagging eval: replays the 80-photo QA gallery against a local
 * llama.cpp `llama-server` (OpenAI-compatible) running a Gemma 4 edge model,
 * using the EXACT production prompt + JSON-schema contract from
 * supabase/functions/_shared/prompts.ts, then scores agreement against the
 * stored cloud (Qwen2.5-VL-72B) results in tag_results.json.
 *
 * Run (needs the Deno import map for zod):
 *   npx deno run -A --config supabase/functions/deno.json scripts/eval-local-tagging.ts \
 *     --server http://127.0.0.1:8080 --label e2b
 *
 * Uses only node:-prefixed APIs (no Deno globals) so the app's tsc also
 * type-checks this file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { buildTagItemPrompt, ITEM_TAGS_JSON_SCHEMA } from '../supabase/functions/_shared/prompts.ts';
import { ItemTagsSchema, type ItemTags } from '../supabase/functions/_shared/types.ts';

const DEFAULT_GALLERY = 'C:/Users/mariu/Pictures/clothing-test-gallery';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const server = arg('server', 'http://127.0.0.1:8080');
const label = arg('label', 'local');
const gallery = arg('gallery', DEFAULT_GALLERY);
const limit = Number(arg('limit', '0')) || Infinity;

interface BaselineEntry {
  file: string;
  expected: string;
  tags: ItemTags | null;
  error: string | null;
}

const baseline: BaselineEntry[] = JSON.parse(
  readFileSync(join(gallery, 'tag_results.json'), 'utf-8'),
);

async function tagLocally(imageBase64: string): Promise<{ tags: ItemTags | null; ms: number; attempts: number }> {
  const started = Date.now();
  let tags: ItemTags | null = null;
  let attempts = 0;
  // Mirror the edge fn: up to 2 attempts, nudge appended on retry.
  for (; attempts < 2 && !tags; attempts++) {
    const prompt =
      attempts === 0
        ? buildTagItemPrompt('ro')
        : buildTagItemPrompt('ro') +
          '\nYour previous reply was not valid JSON matching the schema. Return ONLY the JSON object.';
    const response = await fetch(`${server}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.2,
        // Gemma 4 is a thinking model; tagging wants the direct answer — with
        // thinking on, the JSON grammar fights the think prelude and output
        // lands in reasoning_content. Same flag needed in the on-device path.
        chat_template_kwargs: { enable_thinking: false },
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'item_tags', strict: true, schema: ITEM_TAGS_JSON_SCHEMA },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`llama-server ${response.status}: ${await response.text()}`);
    }
    const payload = await response.json();
    const content: string = payload.choices?.[0]?.message?.content ?? '';
    try {
      tags = ItemTagsSchema.parse(JSON.parse(content));
    } catch {
      tags = null;
    }
  }
  return { tags, ms: Date.now() - started, attempts };
}

const overlap = (a: string[], b: string[]) => a.filter((value) => b.includes(value)).length;

interface Row {
  file: string;
  expected: string;
  ok: boolean;
  ms: number;
  attempts: number;
  categoryCorrect: boolean | null;
  categoryMatchesCloud: boolean | null;
  colorOverlap: number | null;
  dominantColorHit: boolean | null;
  styleOverlap: number | null;
  patternMatch: boolean | null;
  materialMatch: boolean | null;
  fitMatch: boolean | null;
  layerMatch: boolean | null;
  formalityDelta: number | null;
  warmthDelta: number | null;
  seasonOverlap: number | null;
  occasionOverlap: number | null;
}

const rows: Row[] = [];
const localTags: Record<string, ItemTags | null> = {};

let done = 0;
for (const entry of baseline.slice(0, limit === Infinity ? baseline.length : limit)) {
  if (!entry.tags) continue; // cloud itself failed on this one; nothing to compare
  const imageBase64 = readFileSync(join(gallery, entry.file)).toString('base64');
  const { tags, ms, attempts } = await tagLocally(imageBase64);
  localTags[entry.file] = tags;
  const cloud = entry.tags;
  rows.push({
    file: entry.file,
    expected: entry.expected,
    ok: tags !== null,
    ms,
    attempts,
    categoryCorrect: tags ? tags.category === entry.expected : null,
    categoryMatchesCloud: tags ? tags.category === cloud.category : null,
    colorOverlap: tags ? overlap(tags.colors, cloud.colors) : null,
    dominantColorHit: tags ? tags.colors.includes(cloud.colors[0]) : null,
    styleOverlap: tags ? overlap(tags.style_tags, cloud.style_tags) : null,
    patternMatch: tags ? tags.pattern === cloud.pattern : null,
    materialMatch: tags ? tags.material === cloud.material : null,
    fitMatch: tags ? tags.fit === cloud.fit : null,
    layerMatch: tags ? tags.layer === cloud.layer : null,
    formalityDelta: tags ? Math.abs(tags.formality - cloud.formality) : null,
    warmthDelta: tags ? Math.abs(tags.warmth - cloud.warmth) : null,
    seasonOverlap: tags ? overlap(tags.seasons, cloud.seasons) : null,
    occasionOverlap: tags ? overlap(tags.occasions, cloud.occasions) : null,
  });
  done++;
  const status = tags ? (tags.category === entry.expected ? 'ok ' : 'CAT') : 'FAIL';
  console.log(`[${done}] ${entry.file} ${status} ${(ms / 1000).toFixed(1)}s`);
}

// ---- outputs ----

const header = Object.keys(rows[0] ?? { file: '' }).join(',');
const csv = [header, ...rows.map((row) => Object.values(row).join(','))].join('\n');
writeFileSync(join(gallery, `local_eval_${label}.csv`), csv);
writeFileSync(join(gallery, `local_tags_${label}.json`), JSON.stringify(localTags, null, 2));

const valid = rows.filter((row) => row.ok);
const pct = (count: number, total = valid.length) => `${((100 * count) / Math.max(total, 1)).toFixed(1)}%`;
const cloudCategoryCorrect = baseline.filter((entry) => entry.tags && entry.tags.category === entry.expected).length;

console.log(`\n=== ${label} vs cloud (n=${rows.length}, parsed=${valid.length}) ===`);
console.log(`parse failures:         ${rows.length - valid.length}`);
console.log(`category vs truth:      ${pct(valid.filter((row) => row.categoryCorrect).length)} (cloud: ${pct(cloudCategoryCorrect, baseline.filter((entry) => entry.tags).length)})`);
console.log(`category vs cloud:      ${pct(valid.filter((row) => row.categoryMatchesCloud).length)}`);
console.log(`dominant color hit:     ${pct(valid.filter((row) => row.dominantColorHit).length)}`);
console.log(`style overlap >=1:      ${pct(valid.filter((row) => (row.styleOverlap ?? 0) >= 1).length)}`);
console.log(`pattern match:          ${pct(valid.filter((row) => row.patternMatch).length)}`);
console.log(`material match:         ${pct(valid.filter((row) => row.materialMatch).length)}`);
console.log(`layer match:            ${pct(valid.filter((row) => row.layerMatch).length)}`);
console.log(`formality |d|<=1:       ${pct(valid.filter((row) => (row.formalityDelta ?? 9) <= 1).length)}`);
console.log(`warmth |d|<=1:          ${pct(valid.filter((row) => (row.warmthDelta ?? 9) <= 1).length)}`);
const msValues = valid.map((row) => row.ms).sort((a, b) => a - b);
if (msValues.length) {
  console.log(`latency s (p50/p90):    ${(msValues[Math.floor(msValues.length * 0.5)] / 1000).toFixed(1)} / ${(msValues[Math.floor(msValues.length * 0.9)] / 1000).toFixed(1)}`);
}
