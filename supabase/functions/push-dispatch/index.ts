// Cron worker: drains the notifications outbox through the Expo Push API.
// Users without a registered push token get their rows marked 'no_token'
// (the in-app history still shows them once that UI exists).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { isServiceRole } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (!isServiceRole(req)) {
    return jsonResponse({ error: 'service role only' }, 401);
  }
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: pending, error } = await admin
    .from('notifications')
    .select('id, user_id, title, body, payload')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (error) return jsonResponse({ error: 'query failed' }, 500);
  if (!pending?.length) return jsonResponse({ sent: 0, no_token: 0 });

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const { data: tokens } = await admin
    .from('push_tokens')
    .select('user_id, expo_token')
    .in('user_id', userIds);
  const tokensByUser = new Map<string, string[]>();
  for (const row of tokens ?? []) {
    tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row.expo_token]);
  }

  const now = new Date().toISOString();
  const messages: { to: string; title: string; body: string; data: unknown; _nid: string }[] = [];
  let noToken = 0;

  for (const notification of pending) {
    const userTokens = tokensByUser.get(notification.user_id) ?? [];
    if (userTokens.length === 0) {
      await admin
        .from('notifications')
        .update({ sent_at: now, receipt_status: 'no_token' })
        .eq('id', notification.id);
      noToken++;
      continue;
    }
    for (const token of userTokens) {
      messages.push({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.payload,
        _nid: notification.id,
      });
    }
  }

  let sent = 0;
  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map(({ _nid: _, ...message }) => message)),
      });
      const json = await res.json().catch(() => null);
      const tickets: { status: string; details?: { error?: string } }[] = json?.data ?? [];
      for (let j = 0; j < chunk.length; j++) {
        const ticket = tickets[j];
        const status = ticket?.status === 'ok' ? 'ok' : (ticket?.details?.error ?? 'error');
        await admin
          .from('notifications')
          .update({ sent_at: now, receipt_status: status })
          .eq('id', chunk[j]._nid);
        if (status === 'DeviceNotRegistered') {
          await admin.from('push_tokens').delete().eq('expo_token', chunk[j].to);
        } else if (status === 'ok') {
          sent++;
        }
      }
    } catch {
      // leave rows unsent; next cron tick retries
    }
  }

  return jsonResponse({ sent, no_token: noToken, queued: pending.length });
});
