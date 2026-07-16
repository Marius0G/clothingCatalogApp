// Ingests an affiliate product feed (2Performant/Profitshare-style CSV) into
// catalog_products. Service-role only (cron or manual). Body: {feed_url} to
// download, or {csv} inline for testing. Expected columns (header names are
// matched case-insensitively, extra columns ignored):
//   external_id/product_id, title/name, brand, price, currency, category,
//   image_url/image, url/product_url, affiliate_url/aff_link, merchant
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { parsePrice } from '../_shared/parsers/index.ts';

/** Minimal CSV parser with quoted-field support. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  external_id: ['external_id', 'product_id', 'id', 'sku'],
  title: ['title', 'name', 'product_name'],
  brand: ['brand', 'manufacturer'],
  price: ['price', 'sale_price', 'price_with_vat'],
  currency: ['currency'],
  category: ['category', 'category_name'],
  image_url: ['image_url', 'image', 'image_urls'],
  url: ['url', 'product_url', 'link'],
  affiliate_url: ['affiliate_url', 'aff_link', 'aff_code', 'tracking_url'],
  merchant: ['merchant', 'advertiser', 'campaign_name', 'shop'],
};

function buildColumnMap(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  const normalized = header.map((h) => h.trim().toLowerCase());
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const index = normalized.indexOf(alias);
      if (index !== -1) {
        map.set(key, index);
        break;
      }
    }
  }
  return map;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return jsonResponse({ error: 'service role only' }, 401);
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const body = await req.json().catch(() => ({}));
  let csv: string | null = typeof body?.csv === 'string' ? body.csv : null;
  const network = typeof body?.network === 'string' ? body.network : '2performant';
  if (!csv && typeof body?.feed_url === 'string') {
    try {
      const res = await fetch(body.feed_url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return jsonResponse({ error: 'feed fetch failed' }, 422);
      csv = await res.text();
    } catch {
      return jsonResponse({ error: 'feed fetch failed' }, 422);
    }
  }
  if (!csv) return jsonResponse({ error: 'csv or feed_url required' }, 400);

  const rows = parseCsv(csv);
  if (rows.length < 2) return jsonResponse({ error: 'empty feed' }, 422);
  const columns = buildColumnMap(rows[0]);
  if (!columns.has('external_id') || !columns.has('title') || !columns.has('url')) {
    return jsonResponse({ error: 'feed missing required columns' }, 422);
  }

  const get = (row: string[], key: string): string | null => {
    const index = columns.get(key);
    const value = index !== undefined ? row[index]?.trim() : '';
    return value ? value : null;
  };

  let upserted = 0;
  let skipped = 0;
  const now = new Date().toISOString();
  for (const row of rows.slice(1)) {
    const externalId = get(row, 'external_id');
    const title = get(row, 'title');
    const url = get(row, 'url');
    if (!externalId || !title || !url) {
      skipped++;
      continue;
    }
    const { error } = await admin.from('catalog_products').upsert(
      {
        source: 'affiliate',
        network,
        merchant: get(row, 'merchant'),
        external_id: externalId,
        url,
        affiliate_url: get(row, 'affiliate_url'),
        title,
        brand: get(row, 'brand'),
        image_url: get(row, 'image_url'),
        price: parsePrice(get(row, 'price')),
        currency: get(row, 'currency') ?? 'RON',
        category: get(row, 'category'),
        active: true,
        last_seen_at: now,
      },
      { onConflict: 'network,external_id' },
    );
    if (error) skipped++;
    else upserted++;
  }

  return jsonResponse({ upserted, skipped, total: rows.length - 1 });
});
