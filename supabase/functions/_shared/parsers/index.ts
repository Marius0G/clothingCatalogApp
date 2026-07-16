/**
 * Product-page parsing pipeline: store-aware structured data (JSON-LD + OG)
 * first, LLM extraction as last resort (caller decides — see parse-product).
 * Parsers are regex/JSON based on raw HTML: no DOM library needed because all
 * target stores embed JSON-LD Product blocks or OG meta in the initial HTML.
 */
import { ParsedProductSchema, type ParsedProduct } from '../types.ts';

export type Store = ParsedProduct['store'];

export function detectStore(url: string): Store {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('zara.')) return 'zara';
    if (host.includes('bershka.')) return 'bershka';
    if (host.includes('hm.com') || host.includes('www2.hm.')) return 'hm';
    if (host.includes('vinted.')) return 'vinted';
  } catch {
    // fall through
  }
  return 'generic';
}

/** "79,99", "1.299,00", "79.99 RON" → number */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // If both separators exist, the last one is the decimal mark.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (lastComma > -1 && lastDot > -1) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (lastComma > -1) {
    // Comma as decimal only when followed by 1-2 digits (else thousands sep).
    normalized =
      cleaned.length - lastComma <= 3
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  }
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ---------- JSON-LD ----------

type JsonLdProduct = Record<string, unknown>;

function* iterJsonLdBlocks(html: string): Generator<unknown> {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      yield JSON.parse(match[1].trim());
    } catch {
      // malformed block — skip
    }
  }
}

function findProductNode(node: unknown): JsonLdProduct | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProductNode(child);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'product')) {
    return obj;
  }
  if (obj['@graph']) return findProductNode(obj['@graph']);
  return null;
}

type Extracted = {
  title: string | null;
  brand: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  in_stock: boolean | null;
  sizes_available: { size: string; in_stock: boolean }[] | null;
  external_id: string | null;
};

const EMPTY: Extracted = {
  title: null,
  brand: null,
  image_url: null,
  price: null,
  currency: null,
  in_stock: null,
  sizes_available: null,
  external_id: null,
};

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? decodeEntities(value.trim()) : null;
}

export function extractJsonLd(html: string): Extracted | null {
  for (const block of iterJsonLdBlocks(html)) {
    const product = findProductNode(block);
    if (!product) continue;

    const result: Extracted = { ...EMPTY };
    result.title = str(product.name);
    const brand = product.brand;
    result.brand =
      str(brand) ??
      (brand && typeof brand === 'object' ? str((brand as Record<string, unknown>).name) : null);

    const image = product.image;
    result.image_url = Array.isArray(image) ? str(image[0]) : str(image);
    result.external_id = str(product.sku) ?? str(product.productID);

    const offersRaw = product.offers;
    const offers = Array.isArray(offersRaw) ? offersRaw : offersRaw ? [offersRaw] : [];
    const sizes: { size: string; in_stock: boolean }[] = [];
    for (const offerUnknown of offers) {
      if (!offerUnknown || typeof offerUnknown !== 'object') continue;
      const offer = offerUnknown as Record<string, unknown>;
      if (result.price === null) {
        result.price =
          parsePrice(offer.price) ??
          parsePrice((offer.priceSpecification as Record<string, unknown>)?.price);
      }
      if (!result.currency) result.currency = str(offer.priceCurrency);
      const availability = str(offer.availability)?.toLowerCase() ?? '';
      const inStock = availability.includes('instock')
        ? true
        : availability.includes('outofstock')
          ? false
          : null;
      if (inStock !== null) {
        result.in_stock = result.in_stock === true || inStock;
      }
      const sizeName = str(offer.name) ?? str(offer.sku);
      if (sizeName && offers.length > 1 && inStock !== null) {
        sizes.push({ size: sizeName, in_stock: inStock });
      }
    }
    if (sizes.length > 0) result.sizes_available = sizes;

    if (result.title) return result;
  }
  return null;
}

// ---------- Open Graph / meta ----------

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property.replace(/[:.]/g, '\\$&')}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property.replace(/[:.]/g, '\\$&')}["']`,
    'i',
  );
  const match = re.exec(html);
  const value = match?.[1] ?? match?.[2];
  return value ? decodeEntities(value.trim()) : null;
}

export function extractOg(html: string): Extracted | null {
  const result: Extracted = { ...EMPTY };
  result.title = metaContent(html, 'og:title') ?? metaContent(html, 'twitter:title');
  result.image_url = metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image');
  result.price = parsePrice(
    metaContent(html, 'product:price:amount') ??
      metaContent(html, 'og:price:amount') ??
      metaContent(html, 'product:price'),
  );
  result.currency =
    metaContent(html, 'product:price:currency') ?? metaContent(html, 'og:price:currency');
  result.brand = metaContent(html, 'product:brand') ?? metaContent(html, 'og:brand');
  const availability = metaContent(html, 'product:availability')?.toLowerCase() ?? '';
  if (availability) {
    result.in_stock = availability.includes('instock') || availability === 'in stock';
  }
  return result.title ? result : null;
}

// ---------- store quirks ----------

function applyStoreQuirks(store: Store, url: string, html: string, base: Extracted): Extracted {
  const result = { ...base };
  if (store === 'zara' || store === 'bershka') {
    // Inditex brand is rarely in structured data — it's the store itself.
    result.brand = result.brand ?? (store === 'zara' ? 'Zara' : 'Bershka');
    result.external_id =
      result.external_id ?? (/[?&]v1=(\d+)/.exec(url)?.[1] ?? /-p(\d+)\.html/.exec(url)?.[1] ?? null);
  }
  if (store === 'hm') {
    result.brand = result.brand ?? 'H&M';
    result.external_id =
      result.external_id ?? (/productpage\.(\d+)\.html/i.exec(url)?.[1] ?? null);
  }
  if (store === 'vinted') {
    result.external_id = result.external_id ?? (/\/items\/(\d+)/.exec(url)?.[1] ?? null);
    // Vinted titles look like "Title | Brand | Vinted"; brand often 2nd segment.
    if (!result.brand && result.title?.includes('|')) {
      const segments = result.title.split('|').map((s) => s.trim());
      if (segments.length >= 2 && segments[1].toLowerCase() !== 'vinted') {
        result.brand = segments[1];
      }
      result.title = segments[0];
    }
  }
  void html;
  return result;
}

// ---------- assembly ----------

export type ParseOutcome = {
  product: ParsedProduct | null;
  /** true when structured data was too thin and the LLM should take over */
  needsLlm: boolean;
  /** best-effort partial to seed the LLM prompt / merge with its output */
  partial: Extracted;
};

export function parseStructured(url: string, html: string): ParseOutcome {
  const store = detectStore(url);
  const jsonLd = extractJsonLd(html);
  const og = extractOg(html);

  const merged: Extracted = { ...EMPTY };
  for (const source of [jsonLd, og]) {
    if (!source) continue;
    for (const key of Object.keys(merged) as (keyof Extracted)[]) {
      if (merged[key] === null && source[key] !== null) {
        // deno-lint-ignore no-explicit-any
        (merged as any)[key] = source[key];
      }
    }
  }
  const withQuirks = applyStoreQuirks(store, url, html, merged);

  const complete = !!withQuirks.title && (withQuirks.price !== null || !!withQuirks.image_url);
  if (!complete) {
    return { product: null, needsLlm: true, partial: withQuirks };
  }

  const canonical = metaContent(html, 'og:url');
  const product = ParsedProductSchema.parse({
    ...withQuirks,
    colors: null,
    canonical_url: canonical && /^https?:\/\//.test(canonical) ? canonical : null,
    image_url:
      withQuirks.image_url && /^https?:\/\//.test(withQuirks.image_url)
        ? withQuirks.image_url
        : null,
    store,
    parse_method: jsonLd || og ? (store === 'generic' ? 'og' : 'dedicated') : 'og',
  });
  return { product, needsLlm: false, partial: withQuirks };
}

/** Strips markup down to meta tags + visible text for the LLM fallback. */
export function htmlForLlm(html: string, maxLength = 30_000): string {
  const metaBlock = (html.match(/<meta[^>]+>/gi) ?? []).slice(0, 60).join('\n');
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  return `${metaBlock}\n---\n${text}`.slice(0, maxLength);
}
