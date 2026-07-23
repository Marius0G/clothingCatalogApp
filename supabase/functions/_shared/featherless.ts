/**
 * Provider-agnostic OpenAI-compatible chat client. Text goes to Featherless
 * (the 300€ credit pool); vision can point elsewhere via VISION_* env vars if
 * Featherless vision serving disappoints (spike S2 fallback).
 */

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

export type ChatResult = {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export class AiUnavailable extends Error {}

const DEFAULTS = {
  baseUrl: 'https://api.featherless.ai/v1',
  // Llama-3.3-70B is gated on Featherless (needs HF OAuth); Qwen is open.
  textModel: 'Qwen/Qwen2.5-72B-Instruct',
  // 72B: the 7B variant is frequently at capacity on Featherless (verified 2026-07-16)
  visionModel: 'Qwen/Qwen2.5-VL-72B-Instruct',
};

function resolveConfig(kind: 'text' | 'vision') {
  const baseKey = Deno.env.get('FEATHERLESS_API_KEY');
  const baseUrl = Deno.env.get('FEATHERLESS_BASE_URL') ?? DEFAULTS.baseUrl;
  if (kind === 'vision') {
    return {
      apiKey: Deno.env.get('VISION_API_KEY') ?? baseKey,
      baseUrl: Deno.env.get('VISION_BASE_URL') ?? baseUrl,
      model: Deno.env.get('VISION_MODEL') ?? DEFAULTS.visionModel,
    };
  }
  return {
    apiKey: baseKey,
    baseUrl,
    model: Deno.env.get('TEXT_MODEL') ?? DEFAULTS.textModel,
  };
}

// The Featherless plan has 4 concurrency units and one VL-72B request costs
// all 4, so overlapping vision calls (two users tagging at once) are rejected
// instantly with "Concurrency limit exceeded". Those are worth waiting out.
const RETRY_DELAYS_MS = [4000, 9000];

function isTransient(status: number, body: string): boolean {
  return status === 429 || status === 503 || body.includes('Concurrency limit');
}

export async function chatCompletion(
  kind: 'text' | 'vision',
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<ChatResult> {
  const { apiKey, baseUrl, model } = resolveConfig(kind);
  if (!apiKey) {
    throw new AiUnavailable('AI api key not configured');
  }

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.2,
      }),
    });
    if (res.ok) break;

    const body = await res.text().catch(() => '');
    if (attempt < RETRY_DELAYS_MS.length && isTransient(res.status, body)) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
      continue;
    }
    console.error(`AI provider ${res.status} after ${attempt + 1} attempt(s): ${body.slice(0, 300)}`);
    throw new AiUnavailable(`AI provider ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new AiUnavailable('AI provider returned no content');
  }
  return {
    content,
    model,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}

/** Pulls the first JSON object out of an LLM reply (fences, prose, etc.). */
export function extractJson(content: string): unknown {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('no JSON object in reply');
  }
  return JSON.parse(content.slice(start, end + 1));
}
