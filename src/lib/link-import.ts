import { parsePrice } from '@/lib/money';
import type { ProductText } from '@/lib/tag-inference';

export type LinkProduct = ProductText & {
  name: string | null;
  brand: string | null;
  price: number | null;
  // Every product photo found on the page, best first, so the user can pick one.
  images: string[];
};

export type LinkImportResult =
  | { ok: true; product: LinkProduct }
  | { ok: false; reason: 'no-link' | 'blocked' | 'no-data' | 'network' };

// Many shops reject requests that don't look like a browser, so identify as mobile Safari.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TIMEOUT_MS = 15_000;
const MAX_IMAGES = 12;
const MAX_DETAILS = 20;

// Share sheets often paste "Look at this! https://shop.com/item?ref=app", so pull the link out.
export function extractLink(text: string) {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (match) return match[0].replace(/[).,!?]+$/, '');
  const bare = text.trim();
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(bare) ? `https://${bare}` : null;
}

function originOf(url: string) {
  return url.match(/^(https?:\/\/[^/?#]+)/i)?.[1] ?? '';
}

// React Native's URL class is incomplete, so resolve image paths by hand.
function absoluteUrl(value: string, pageUrl: string) {
  if (value.startsWith('//')) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:/i, 'https:');
  if (value.startsWith('/')) return `${originOf(pageUrl)}${value}`;
  return `${pageUrl.replace(/[?#].*$/, '').replace(/[^/]*$/, '')}${value}`;
}

export function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

// Reads every <meta property|name|itemprop="key" content="..."> value for the
// keys, in key order, in either attribute order and with either quote style
// (so "Men's shirt" survives).
function metaContents(html: string, ...keys: string[]) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const values: string[] = [];
  for (const key of keys) {
    for (const tag of tags) {
      const name = tag.match(/\b(?:property|name|itemprop)\s*=\s*(["'])(.*?)\1/i)?.[2];
      if (name?.toLowerCase() !== key.toLowerCase()) continue;
      const content = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
      if (content?.trim()) values.push(decodeEntities(content));
    }
  }
  return values;
}

function metaContent(html: string, ...keys: string[]) {
  return metaContents(html, ...keys)[0] ?? null;
}

function attribute(tag: string, name: string) {
  const value = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))?.[2];
  return value ? decodeEntities(value) : null;
}

// Logos, icons, payment badges and the like share the product image CDN.
const NOT_A_PRODUCT_PHOTO =
  /\.(svg|gif)(\?|$)|logo|icon|sprite|badge|payment|placeholder|avatar|flag|swatch|[/_-]chips?[/_.-]|loader|spinner|pixel|blank\./i;

// Query parameters that only choose a size or format of the same image.
const SIZE_PARAMS =
  /^(w|h|wid|hei|width|height|imwidth|imheight|size|sw|sh|q|qlt|quality|fit|crop|fmt|format|auto|dpr|v|resize|scale|op_sharpen|ts)$/i;

// Shopify serves any size of an image from the same file name with a suffix
// like _200x or _400x600@2x. Dropping the suffix gives the full-size original.
export function shopifyOriginal(url: string) {
  if (!/cdn\.shopify\.com|\/cdn\/shop\//i.test(url)) return url;
  return url.replace(
    /_(\d+x\d*|x\d+|pico|icon|thumb|small|compact|medium|large|grande|master)(@\dx)?(?=\.\w+(\?|$))/i,
    '',
  );
}

// Identifies an image regardless of the size it was requested at, so the same
// photo in the gallery, the thumbnails and the meta tags is offered only once.
function imageKey(url: string) {
  const [path, query = ''] = shopifyOriginal(url)
    .replace(/^https?:/i, '')
    .split('#')[0]
    .split('?');
  const identity = query
    .split('&')
    .filter((pair) => pair && !SIZE_PARAMS.test(pair.split('=')[0]))
    .sort()
    .join('&');
  return `${path.toLowerCase()}?${identity}`;
}

// The largest candidate in a srcset like "a.jpg 400w, b.jpg 800w".
function largestInSrcset(srcset: string) {
  let best: { url: string; size: number } | null = null;
  for (const candidate of srcset.split(/,\s+(?=\S)/)) {
    const [url, descriptor = '1x'] = candidate.trim().split(/\s+/);
    const size = parseFloat(descriptor) * (descriptor.endsWith('x') ? 1000 : 1);
    if (url && (!best || size > best.size)) best = { url, size };
  }
  return best?.url ?? null;
}

// Makes image URLs absolute, drops non-photos and duplicates, and keeps the first few.
function cleanImages(urls: (string | null | undefined)[], pageUrl: string) {
  const seen = new Set<string>();
  const images: string[] = [];
  for (const raw of urls) {
    const value = raw?.trim();
    if (!value || value.startsWith('data:') || NOT_A_PRODUCT_PHOTO.test(value)) continue;
    const url = shopifyOriginal(absoluteUrl(value, pageUrl));
    const key = imageKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    images.push(url);
    if (images.length === MAX_IMAGES) break;
  }
  return images;
}

const RECOMMENDATIONS =
  /you (may|might) also (like|love)|recommended for you|related products|recently viewed|complete the look|shop the look|customers also|pairs well with|wear it with/i;

// The folder an image lives in on its host, like //cdn.shop.com/products/123/.
function imageFolder(url: string) {
  return url
    .replace(/^https?:/i, '')
    .replace(/[?#].*$/, '')
    .replace(/[^/]*$/, '')
    .toLowerCase();
}

// Gallery photos in the page's HTML (<img>, lazy-loading data-* attributes and
// srcsets). Pages have plenty of other images, so only those stored alongside a
// product photo the page already named (from JSON-LD, meta tags or Shopify) count.
function galleryImages(html: string, known: string[], pageUrl: string) {
  const folders = new Set(known.map((url) => imageFolder(absoluteUrl(url, pageUrl))));
  if (folders.size === 0) return [];
  // Other products' photos come after headings like "You may also like".
  const end = html.search(RECOMMENDATIONS);
  const gallery = end === -1 ? html : html.slice(0, end);
  const found: string[] = [];
  for (const tag of gallery.match(/<(?:img|source)\b[^>]*>/gi) ?? []) {
    const width = Number(attribute(tag, 'width'));
    if (width > 0 && width < 150) continue;
    const srcset = attribute(tag, 'data-srcset') ?? attribute(tag, 'srcset');
    const candidates = [
      attribute(tag, 'data-zoom-image'),
      attribute(tag, 'data-zoom'),
      attribute(tag, 'data-large'),
      srcset ? largestInSrcset(srcset) : null,
      attribute(tag, 'data-src'),
      attribute(tag, 'src'),
    ];
    const url = candidates.find((value) => value && !value.startsWith('data:'));
    if (url && folders.has(imageFolder(absoluteUrl(url, pageUrl)))) found.push(url);
  }
  return found;
}

// Product photos anywhere in the page (including the JSON a JavaScript page is
// built from) whose path carries the product's number from the link, like
// Uniqlo's .../imagesgoods/465185/sub/... photos for /products/E465185-000.
// Only on the same host as a photo the page already named, and only numbers of
// five or more digits that also appear in that photo's path.
function productIdImages(html: string, known: string[], pageUrl: string) {
  const knownUrls = known.map((url) => absoluteUrl(url, pageUrl));
  const hosts = new Set(knownUrls.map((url) => originOf(url).toLowerCase()));
  const pagePath = pageUrl.replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '');
  const ids = [...new Set(pagePath.match(/\d{5,}/g) ?? [])].filter((id) =>
    knownUrls.some((url) => new RegExp(`(^|\\D)${id}(\\D|$)`).test(url.replace(/[?#].*$/, ''))),
  );
  if (ids.length === 0) return [];
  const text = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const found: string[] = [];
  for (const match of text.matchAll(
    /(?:https?:)?\/\/[^\s"'<>()\\]+?\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>()\\]*)?/gi,
  )) {
    const url = absoluteUrl(match[0], pageUrl);
    const path = url.replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '');
    if (!hosts.has(originOf(url).toLowerCase())) continue;
    if (ids.some((id) => new RegExp(`(^|\\D)${id}(\\D|$)`).test(path))) found.push(url);
  }
  // Photos next to the one already named are usually its other colors, so the
  // extra angles and details of this one come first.
  const folders = new Set(knownUrls.map(imageFolder));
  return [
    ...found.filter((url) => !folders.has(imageFolder(url))),
    ...found.filter((url) => folders.has(imageFolder(url))),
  ];
}

type JsonLdNode = Record<string, unknown>;

function asText(value: unknown): string | null {
  if (typeof value === 'string') return decodeEntities(value) || null;
  if (Array.isArray(value)) return asText(value[0]);
  if (value && typeof value === 'object' && 'name' in value)
    return asText((value as JsonLdNode).name);
  return null;
}

function asImages(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(asImages);
  if (value && typeof value === 'object') {
    const node = value as JsonLdNode;
    return asImages(node.contentUrl ?? node.url);
  }
  return [];
}

// schema.org additionalProperty entries like { name: "Fabric", value: "100% cotton" }.
function propertyDetails(value: unknown): string[] {
  return [value].flat().flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const node = entry as JsonLdNode;
    const name = asText(node.name);
    const detail = asText(node.value);
    return name && detail ? [`${name}: ${detail}`] : [];
  });
}

// Shops write prices as "49.99", "49,99" or "1.299,00"; zero means "no price shown".
function toPrice(value: unknown): number | null {
  const number = parsePrice(value);
  return number && number > 0 ? number : null;
}

function offerPrice(offers: unknown): number | null {
  const offer = (Array.isArray(offers) ? offers[0] : offers) as JsonLdNode | undefined;
  if (!offer || typeof offer !== 'object') return null;
  const spec = offer.priceSpecification as JsonLdNode | JsonLdNode[] | undefined;
  return (
    toPrice(offer.price) ??
    toPrice(offer.lowPrice) ??
    toPrice(Array.isArray(spec) ? spec[0]?.price : spec?.price)
  );
}

function isProduct(node: JsonLdNode) {
  return [node['@type']].flat().some((type) => type === 'Product' || type === 'ProductGroup');
}

// Finds a schema.org Product (or ProductGroup, used by newer Shopify themes) in the page's JSON-LD.
function jsonLdProduct(html: string): LinkProduct | null {
  const scripts = html.match(/<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const nodes = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((node) =>
      node && typeof node === 'object' && Array.isArray((node as JsonLdNode)['@graph'])
        ? ((node as JsonLdNode)['@graph'] as unknown[])
        : [node],
    ) as JsonLdNode[];
    const product = nodes.find((node) => node && typeof node === 'object' && isProduct(node));
    if (!product) continue;
    const variants = (Array.isArray(product.hasVariant) ? product.hasVariant : []) as JsonLdNode[];
    const variant = variants[0];
    return {
      name: asText(product.name),
      brand: asText(product.brand),
      price: offerPrice(product.offers) ?? offerPrice(variant?.offers),
      images: [...asImages(product.image), ...variants.flatMap((entry) => asImages(entry?.image))],
      color: asText(product.color) ?? asText(variant?.color),
      material: asText(product.material) ?? asText(variant?.material),
      pattern: asText(product.pattern) ?? asText(variant?.pattern),
      category: asText(product.category),
      description: asText(product.description) ?? asText(variant?.description),
      details: propertyDetails(product.additionalProperty),
    };
  }
  return null;
}

async function fetchWithTimeout(url: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type ShopifyProduct = {
  title?: string;
  vendor?: string;
  type?: string;
  tags?: string[] | string;
  description?: string;
  price?: number; // in cents
  featured_image?: string;
  images?: string[];
  media?: { media_type?: string; src?: string }[];
  options?: ({ name: string; values?: string[] } | string)[];
  variants?: { id: number; options?: string[]; featured_image?: { src?: string } | null }[];
};

function optionName(option: NonNullable<ShopifyProduct['options']>[number]) {
  return typeof option === 'string' ? option : option.name;
}

// The variant in the link (?variant=123), if any.
function shopifyVariant(product: ShopifyProduct, url: string) {
  const variantId = Number(url.match(/[?&]variant=(\d+)/)?.[1]);
  return product.variants?.find((entry) => entry.id === variantId);
}

// The size of the variant in the link. Without a variant the size isn't known.
function shopifySize(product: ShopifyProduct, url: string) {
  const index = (product.options ?? []).findIndex((option) => /^size$/i.test(optionName(option)));
  return index === -1 ? null : (shopifyVariant(product, url)?.options?.[index] ?? null);
}

// Options other than size and color, like "Material: Organic cotton" or "Fit: Relaxed".
function shopifyDetails(product: ShopifyProduct, url: string) {
  const variant = shopifyVariant(product, url) ?? product.variants?.[0];
  return (product.options ?? []).flatMap((option, index) => {
    const name = optionName(option);
    const value = variant?.options?.[index];
    return value && !/^(size|title|colou?r)$/i.test(name) ? [`${name}: ${value}`] : [];
  });
}

// The color of the variant in the link (?variant=123), or the first color option.
function shopifyColor(product: ShopifyProduct, url: string) {
  const index = (product.options ?? []).findIndex((option) => /colou?r/i.test(optionName(option)));
  if (index === -1) return null;
  const variant = shopifyVariant(product, url);
  const option = product.options![index];
  return (
    variant?.options?.[index] ?? (typeof option === 'string' ? null : option.values?.[0]) ?? null
  );
}

// Shopify stores (a large share of clothing brands) serve product JSON at <product url>.js,
// which works even when the HTML page is rendered by JavaScript.
async function shopifyProduct(url: string): Promise<LinkProduct | null> {
  const path = url.replace(/[?#].*$/, '');
  if (!/\/products\/[^/]+$/.test(path)) return null;
  try {
    const response = await fetchWithTimeout(`${path}.js`, {
      ...BROWSER_HEADERS,
      Accept: 'application/json',
    });
    if (!response.ok) return null;
    const product = (await response.json()) as ShopifyProduct;
    if (!product.title) return null;
    return {
      name: product.title,
      brand: product.vendor ?? null,
      price: typeof product.price === 'number' ? product.price / 100 : null,
      // The linked variant's photo first, so a green shirt's link opens on the green one.
      images: [
        shopifyVariant(product, url)?.featured_image?.src,
        product.featured_image,
        ...(product.images ?? []),
        ...(product.media ?? [])
          .filter((media) => media.media_type === 'image')
          .map((media) => media.src),
      ].filter((image): image is string => !!image),
      color: shopifyColor(product, url),
      size: shopifySize(product, url),
      category: product.type || null,
      description: product.description ?? null,
      keywords: typeof product.tags === 'string' ? product.tags.split(',') : (product.tags ?? []),
      details: shopifyDetails(product, url),
    };
  } catch {
    return null;
  }
}

function longer(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.length > a.length * 1.5 ? b : a;
}

function merge(primary: LinkProduct | null, fallback: LinkProduct): LinkProduct {
  return {
    name: primary?.name ?? fallback.name,
    brand: primary?.brand ?? fallback.brand,
    price: primary?.price ?? fallback.price,
    images: [...(primary?.images ?? []), ...fallback.images],
    color: primary?.color ?? fallback.color,
    material: primary?.material ?? fallback.material,
    pattern: primary?.pattern ?? fallback.pattern,
    size: primary?.size ?? fallback.size,
    category: primary?.category ?? fallback.category,
    // A short meta description is often a cut-down copy of the full one, so keep the longer.
    description: longer(primary?.description, fallback.description),
    keywords: [...(primary?.keywords ?? []), ...(fallback.keywords ?? [])],
    details: [...(primary?.details ?? []), ...(fallback.details ?? [])],
  };
}

// Reads a product's name, brand, price, photos, description and details from a
// shop link, using Shopify's product JSON, then the page's JSON-LD, then Open
// Graph / Twitter / microdata tags and labelled details in the page text. `text` can be anything containing a link, like shared text.
export async function importFromLink(text: string): Promise<LinkImportResult> {
  let url = extractLink(text);
  if (!url) return { ok: false, reason: 'no-link' };

  let html = '';
  let blocked = false;
  try {
    const response = await fetchWithTimeout(url, BROWSER_HEADERS);
    // Links in emails and share sheets often go through a tracking redirect,
    // so read the rest from the product page's own address.
    if (/^https?:\/\//i.test(response.url)) url = response.url;
    if (response.ok) {
      html = await response.text();
    } else {
      blocked = [401, 403, 429, 503].includes(response.status);
    }
  } catch {
    const shopify = await shopifyProduct(url);
    return shopify ? { ok: true, product: finish(shopify, url) } : { ok: false, reason: 'network' };
  }

  const fromTags: LinkProduct = {
    name: metaContent(html, 'og:title', 'twitter:title', 'name') ?? pageTitle(html),
    brand: metaContent(html, 'product:brand', 'og:brand', 'brand', 'og:site_name'),
    price: toPrice(metaContent(html, 'product:price:amount', 'og:price:amount', 'price')),
    images: metaContents(
      html,
      'og:image:secure_url',
      'og:image',
      'og:image:url',
      'twitter:image',
      'twitter:image:src',
      'image',
    ),
    color: metaContent(html, 'product:color', 'og:color', 'color'),
    material: metaContent(html, 'product:material', 'material'),
    pattern: metaContent(html, 'product:pattern', 'pattern'),
    category: metaContent(html, 'product:category', 'category'),
    description: metaContent(html, 'og:description', 'description', 'twitter:description'),
    keywords: metaContent(html, 'keywords')?.split(',') ?? [],
    details: pageDetails(html),
  };
  let product = merge(jsonLdProduct(html), fromTags);

  // Shopify's product JSON also has the product type, tags, options and every photo.
  const shopify = await shopifyProduct(url);
  if (shopify) product = merge(shopify, product);
  // Shopify's list is complete, and its shared files folder also holds other products' photos.
  else {
    product.images = [
      ...product.images,
      ...galleryImages(html, product.images, url),
      ...productIdImages(html, product.images, url),
    ];
  }

  // A bot-check or empty JavaScript shell page has a title but no product image.
  if (product.images.length === 0 && !product.price) {
    return { ok: false, reason: blocked ? 'blocked' : 'no-data' };
  }
  return { ok: true, product: finish(product, url) };
}

function pageTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeEntities(title.replace(/\s+/g, ' ')) : null;
}

// Labels shops put in front of product facts, in "Label: value" lines, spec
// tables (<th>/<td>) and definition lists (<dt>/<dd>).
const DETAIL_LABEL =
  /^(colou?r|colou?rway|shade|material|materials|fabric|fabrics|composition|content|fibre|fiber|shell|outer|outer fabric|main|main fabric|body|upper|lining|sole|pattern|print|style|fit|occasion|season|neckline|sleeve|sleeve length|length)\s*:\s*\S/i;

// A fibre composition like "98% cotton, 2% elastane", written anywhere on the page.
const COMPOSITION = /\d{1,3}\s*%\s*[a-z]/i;

// Product facts written in the page's HTML, like "Composition: 100% linen" or a
// spec table row, for pages whose structured data leaves them out. Scripts,
// menus, headers and footers are dropped first so site-wide text isn't read.
export function pageDetails(html: string) {
  const text = html
    .replace(/<(script|style|noscript|svg|template|head|header|footer|nav)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(dt|th)>\s*<(dd|td)\b[^>]*>/gi, ': ')
    .replace(
      /<(br|\/?(p|div|li|ul|ol|tr|dl|dt|dd|h\d|section|article|table|tbody|details|summary))\b[^>]*>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ');
  const details: string[] = [];
  for (const rawLine of decodeEntities(text).split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').replace(/\s+:/g, ':').trim();
    if (line.length < 4 || line.length > 200 || details.includes(line)) continue;
    if (DETAIL_LABEL.test(line) || COMPOSITION.test(line)) details.push(line);
    if (details.length === MAX_DETAILS) break;
  }
  return details;
}

function finish(product: LinkProduct, url: string): LinkProduct {
  return {
    ...product,
    // Page titles often end in " | Shop name".
    name: product.name?.replace(/\s+\|\s+[^|]+$/, '').trim() || product.name,
    images: cleanImages(product.images, url),
    details: [...new Set(product.details ?? [])].slice(0, MAX_DETAILS),
  };
}
