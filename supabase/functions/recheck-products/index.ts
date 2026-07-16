// Cron worker: re-fetches tracked product pages, records price/stock changes
// and enqueues alert notifications. Called by pg_cron with the service key;
// per-product failures degrade gracefully (3 strikes → stale → the owner's
// app re-fetches it client-side on next open).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { parseStructured } from '../_shared/parsers/index.ts';

const BATCH_SIZE = 25;
const RECHECK_AFTER_HOURS = 5;
const RETRIGGER_AFTER_HOURS = 20;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  'Accept-Language': 'ro,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml',
};

type Tracked = {
  id: string;
  item_id: string;
  user_id: string;
  url: string;
  current_price: number | null;
  currency: string | null;
  in_stock: boolean | null;
  sizes_available: { size: string; in_stock: boolean }[] | null;
  check_failures: number;
};

type NotificationText = { title: string; body: string };

function notificationText(
  locale: string,
  kind: 'price_drop' | 'restock',
  itemLabel: string,
  price: number | null,
  currency: string | null,
): NotificationText {
  const priceText = price != null ? `${price.toFixed(2).replace('.', ',')} ${currency ?? ''}`.trim() : '';
  if (locale === 'ro') {
    return kind === 'price_drop'
      ? { title: 'Preț redus', body: `${itemLabel} a scăzut la ${priceText}.` }
      : { title: 'Din nou în stoc', body: `${itemLabel} este din nou disponibil.` };
  }
  return kind === 'price_drop'
    ? { title: 'Price drop', body: `${itemLabel} dropped to ${priceText}.` }
    : { title: 'Back in stock', body: `${itemLabel} is available again.` };
}

async function processOne(admin: SupabaseClient, tracked: Tracked): Promise<'updated' | 'failed'> {
  let html: string | null = null;
  try {
    const res = await fetch(tracked.url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) html = await res.text();
  } catch {
    html = null;
  }

  const parsed = html ? parseStructured(tracked.url, html).product : null;
  if (!parsed) {
    const failures = tracked.check_failures + 1;
    await admin
      .from('tracked_products')
      .update({
        check_failures: failures,
        stale: failures >= 3,
        fetch_strategy: failures >= 3 ? 'client' : 'server',
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', tracked.id);
    return 'failed';
  }

  const priceChanged = parsed.price != null && parsed.price !== tracked.current_price;
  const stockChanged = parsed.in_stock != null && parsed.in_stock !== tracked.in_stock;

  await admin
    .from('tracked_products')
    .update({
      current_price: parsed.price ?? tracked.current_price,
      currency: parsed.currency ?? tracked.currency,
      in_stock: parsed.in_stock ?? tracked.in_stock,
      sizes_available: parsed.sizes_available ?? tracked.sizes_available,
      check_failures: 0,
      stale: false,
      fetch_strategy: 'server',
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', tracked.id);

  if (priceChanged || stockChanged) {
    await admin.from('product_snapshots').insert({
      tracked_product_id: tracked.id,
      price: parsed.price ?? tracked.current_price,
      currency: parsed.currency ?? tracked.currency,
      in_stock: parsed.in_stock ?? tracked.in_stock,
      sizes_available: parsed.sizes_available ?? tracked.sizes_available,
    });
    await evaluateAlerts(admin, tracked, parsed.price, parsed.in_stock, parsed.currency);
  }
  return 'updated';
}

async function evaluateAlerts(
  admin: SupabaseClient,
  tracked: Tracked,
  newPrice: number | null,
  newInStock: boolean | null,
  newCurrency: string | null,
) {
  const { data: alerts } = await admin
    .from('alerts')
    .select('*')
    .eq('tracked_product_id', tracked.id)
    .eq('active', true);
  if (!alerts?.length) return;

  const { data: item } = await admin
    .from('items')
    .select('title, brand')
    .eq('id', tracked.item_id)
    .single();
  const { data: profile } = await admin
    .from('profiles')
    .select('locale')
    .eq('id', tracked.user_id)
    .single();
  const label = [item?.brand, item?.title].filter(Boolean).join(' · ') || 'Produs';
  const retriggerCutoff = Date.now() - RETRIGGER_AFTER_HOURS * 3600 * 1000;

  for (const alert of alerts) {
    if (alert.last_triggered_at && new Date(alert.last_triggered_at).getTime() > retriggerCutoff) {
      continue;
    }
    let fire = false;
    if (
      alert.kind === 'price_drop' &&
      newPrice != null &&
      tracked.current_price != null &&
      newPrice < tracked.current_price
    ) {
      fire = alert.threshold == null || newPrice <= alert.threshold;
    }
    if (alert.kind === 'restock' && newInStock === true && tracked.in_stock === false) {
      fire = true;
    }
    if (!fire) continue;

    const text = notificationText(
      profile?.locale ?? 'ro',
      alert.kind,
      label,
      newPrice,
      newCurrency ?? tracked.currency,
    );
    await admin.from('notifications').insert({
      user_id: tracked.user_id,
      kind: alert.kind,
      title: text.title,
      body: text.body,
      payload: { item_id: tracked.item_id },
    });
    await admin
      .from('alerts')
      .update({ last_triggered_at: new Date().toISOString() })
      .eq('id', alert.id);
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return jsonResponse({ error: 'service role only' }, 401);
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const cutoff = new Date(Date.now() - RECHECK_AFTER_HOURS * 3600 * 1000).toISOString();
  const { data: due, error } = await admin
    .from('tracked_products')
    .select('id, item_id, user_id, url, current_price, currency, in_stock, sizes_available, check_failures')
    .eq('stale', false)
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);
  if (error) return jsonResponse({ error: 'query failed' }, 500);

  let updated = 0;
  let failed = 0;
  for (const tracked of due ?? []) {
    const outcome = await processOne(admin, tracked as Tracked);
    if (outcome === 'updated') updated++;
    else failed++;
  }

  // Kick the dispatcher right away so alert pushes go out without waiting
  // for its own cron tick.
  return jsonResponse({ checked: due?.length ?? 0, updated, failed });
});
