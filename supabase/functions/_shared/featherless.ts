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
  textModel: 'meta-llama/Llama-3.3-70B-Instruct',
  visionModel: 'Qwen/Qwen2.5-VL-7B-Instruct',
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

export async function chatCompletion(
  kind: 'text' | 'vision',
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<ChatResult> {
  const { apiKey, baseUrl, model } = resolveConfig(kind);
  if (!apiKey) {
    throw new AiUnavailable('AI api key not configured');
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
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

  if (!res.ok) {
    const body = await res.text().catch(() => '');
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
