// Hidden caps that protect the AI credit pool. Counted in calls/day (not
// tokens) so we never need SQL aggregates: per-user per-endpoint cap plus a
// global daily circuit breaker across all users and endpoints.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type AiEndpoint = 'tag' | 'extract' | 'outfit' | 'purchase';

const USER_DAILY_CAPS: Record<AiEndpoint, number> = {
  tag: 50,
  extract: 30,
  outfit: 20,
  purchase: 20,
};

const GLOBAL_DAILY_CALL_CAP = 2000;

function todayStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export type BudgetCheck = { ok: true } | { ok: false; status: number; reason: string };

export async function checkAiBudget(
  admin: SupabaseClient,
  userId: string,
  endpoint: AiEndpoint,
): Promise<BudgetCheck> {
  const since = todayStart();

  const { count: userCount, error: userError } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', since);
  if (userError) return { ok: false, status: 500, reason: 'usage check failed' };
  if ((userCount ?? 0) >= USER_DAILY_CAPS[endpoint]) {
    return { ok: false, status: 429, reason: 'daily limit reached' };
  }

  const { count: globalCount, error: globalError } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  if (globalError) return { ok: false, status: 500, reason: 'usage check failed' };
  if ((globalCount ?? 0) >= GLOBAL_DAILY_CALL_CAP) {
    return { ok: false, status: 503, reason: 'service busy' };
  }

  return { ok: true };
}

export async function recordAiUsage(
  admin: SupabaseClient,
  usage: {
    userId: string | null;
    endpoint: AiEndpoint;
    model: string;
    promptTokens: number;
    completionTokens: number;
  },
): Promise<void> {
  await admin.from('ai_usage').insert({
    user_id: usage.userId,
    endpoint: usage.endpoint,
    model: usage.model,
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
  });
}
