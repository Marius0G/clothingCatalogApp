import { assertEquals } from 'jsr:@std/assert';

import { detectStore, extractJsonLd, extractOg, htmlForLlm, parsePrice, parseStructured } from './index.ts';

Deno.test('detectStore recognizes target hosts', () => {
  assertEquals(detectStore('https://www.zara.com/ro/ro/camasa-p123.html?v1=456'), 'zara');
  assertEquals(detectStore('https://www.bershka.com/ro/tricou-c0p111.html'), 'bershka');
  assertEquals(detectStore('https://www2.hm.com/ro_ro/productpage.1227437001.html'), 'hm');
  assertEquals(detectStore('https://www.vinted.ro/items/123456-geaca-piele'), 'vinted');
  assertEquals(detectStore('https://shop.example.com/produs'), 'generic');
  assertEquals(detectStore('not a url'), 'generic');
});

Deno.test('parsePrice handles RO/EU formats', () => {
  assertEquals(parsePrice('79,99'), 79.99);
  assertEquals(parsePrice('1.299,00'), 1299);
  assertEquals(parsePrice('79.99'), 79.99);
  assertEquals(parsePrice('1,299.00'), 1299);
  assertEquals(parsePrice('129 RON'), 129);
  assertEquals(parsePrice(49.95), 49.95);
  assertEquals(parsePrice(''), null);
  assertEquals(parsePrice(null), null);
});

const HM_FIXTURE = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Cămașă din bumbac Regular Fit",
"sku":"1227437001","image":["https://image.hm.com/assets/hm/1.jpg"],
"brand":{"@type":"Brand","name":"H&M"},
"offers":[{"@type":"Offer","price":"129.99","priceCurrency":"RON","availability":"https://schema.org/InStock"}]}
</script>
<meta property="og:url" content="https://www2.hm.com/ro_ro/productpage.1227437001.html">
</head><body></body></html>`;

Deno.test('H&M: JSON-LD product parses as dedicated', () => {
  const { product, needsLlm } = parseStructured(
    'https://www2.hm.com/ro_ro/productpage.1227437001.html',
    HM_FIXTURE,
  );
  assertEquals(needsLlm, false);
  assertEquals(product?.title, 'Cămașă din bumbac Regular Fit');
  assertEquals(product?.brand, 'H&M');
  assertEquals(product?.price, 129.99);
  assertEquals(product?.currency, 'RON');
  assertEquals(product?.in_stock, true);
  assertEquals(product?.external_id, '1227437001');
  assertEquals(product?.parse_method, 'dedicated');
});

const VINTED_FIXTURE = `<html><head>
<meta property="og:title" content="Geacă de piele | Zara | Vinted">
<meta property="og:image" content="https://images1.vinted.net/t/abc.jpeg">
<meta property="og:url" content="https://www.vinted.ro/items/654321-geaca-de-piele">
<script type="application/ld+json">{"@context":"http://schema.org","@type":"Product","name":"Geacă de piele","offers":{"@type":"Offer","price":"250.0","priceCurrency":"RON","availability":"http://schema.org/InStock"}}</script>
</head><body></body></html>`;

Deno.test('Vinted: brand pulled from og:title segments, id from url', () => {
  const { product, needsLlm } = parseStructured(
    'https://www.vinted.ro/items/654321-geaca-de-piele',
    VINTED_FIXTURE,
  );
  assertEquals(needsLlm, false);
  assertEquals(product?.title, 'Geacă de piele');
  assertEquals(product?.price, 250);
  assertEquals(product?.external_id, '654321');
  assertEquals(product?.store, 'vinted');
});

const ZARA_FIXTURE = `<html><head>
<script type="application/ld+json">[{"@type":"Product","name":"CĂMAȘĂ OVERSIZE","image":"https://static.zara.net/photos/1.jpg","offers":{"@type":"Offer","price":199.9,"priceCurrency":"RON","availability":"https://schema.org/InStock"},"sku":"12345"}]</script>
</head><body></body></html>`;

Deno.test('Zara: brand defaults to store, array JSON-LD handled', () => {
  const { product } = parseStructured(
    'https://www.zara.com/ro/ro/camasa-oversize-p02298402.html?v1=987654',
    ZARA_FIXTURE,
  );
  assertEquals(product?.brand, 'Zara');
  assertEquals(product?.title, 'CĂMAȘĂ OVERSIZE');
  assertEquals(product?.price, 199.9);
  assertEquals(product?.external_id, '12345');
});

const OG_ONLY_FIXTURE = `<html><head>
<meta property="og:title" content="Hanorac unisex din fleece">
<meta property="og:image" content="https://cdn.shop.ro/img/h.jpg">
<meta property="product:price:amount" content="149,90">
<meta property="product:price:currency" content="RON">
</head><body>content</body></html>`;

Deno.test('generic store with only OG tags → parse_method og', () => {
  const { product, needsLlm } = parseStructured('https://shop.example.ro/hanorac', OG_ONLY_FIXTURE);
  assertEquals(needsLlm, false);
  assertEquals(product?.parse_method, 'og');
  assertEquals(product?.price, 149.9);
  assertEquals(product?.title, 'Hanorac unisex din fleece');
});

Deno.test('hostile page with no structured data → needsLlm', () => {
  const { product, needsLlm, partial } = parseStructured(
    'https://obscure.example.com/p/1',
    '<html><body><h1>Produs</h1><div class="price">89 lei</div></body></html>',
  );
  assertEquals(product, null);
  assertEquals(needsLlm, true);
  assertEquals(partial.title, null);
});

Deno.test('extractJsonLd survives malformed blocks and @graph nesting', () => {
  const html = `<script type="application/ld+json">{broken json</script>
<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"Product","name":"Pantofi","offers":{"price":"300","priceCurrency":"EUR"}}]}</script>`;
  const result = extractJsonLd(html);
  assertEquals(result?.title, 'Pantofi');
  assertEquals(result?.price, 300);
});

Deno.test('extractOg reads reversed attribute order', () => {
  const html = `<meta content="Produs test" property="og:title">`;
  assertEquals(extractOg(html)?.title, 'Produs test');
});

Deno.test('htmlForLlm strips scripts and caps length', () => {
  const html = `<meta property="og:title" content="X"><script>var a=1;</script><p>text vizibil</p>`;
  const out = htmlForLlm(html);
  assertEquals(out.includes('var a=1'), false);
  assertEquals(out.includes('text vizibil'), true);
  assertEquals(out.includes('og:title'), true);
  assertEquals(htmlForLlm('<p>' + 'x'.repeat(50_000) + '</p>').length <= 30_000, true);
});
