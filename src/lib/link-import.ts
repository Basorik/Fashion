import type { ProductText } from '@/lib/tag-inference';

export type LinkProduct = ProductText & {
  name: string | null;
  brand: string | null;
  price: number | null;
  imageUrl: string | null;
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

function decodeEntities(text: string) {
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

// Reads a <meta property|name|itemprop="key" content="..."> value, in either
// attribute order and with either quote style (so "Men's shirt" survives).
function metaContent(html: string, ...keys: string[]) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of keys) {
    for (const tag of tags) {
      const name = tag.match(/\b(?:property|name|itemprop)\s*=\s*(["'])(.*?)\1/i)?.[2];
      if (name?.toLowerCase() !== key.toLowerCase()) continue;
      const content = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
      if (content?.trim()) return decodeEntities(content);
    }
  }
  return null;
}

type JsonLdNode = Record<string, unknown>;

function asText(value: unknown): string | null {
  if (typeof value === 'string') return decodeEntities(value) || null;
  if (Array.isArray(value)) return asText(value[0]);
  if (value && typeof value === 'object' && 'name' in value)
    return asText((value as JsonLdNode).name);
  return null;
}

function asImage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return asImage(value[0]);
  if (value && typeof value === 'object') {
    const node = value as JsonLdNode;
    return asImage(node.url ?? node.contentUrl);
  }
  return null;
}

function toPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
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
    const variant = Array.isArray(product.hasVariant)
      ? (product.hasVariant[0] as JsonLdNode | undefined)
      : undefined;
    return {
      name: asText(product.name),
      brand: asText(product.brand),
      price: offerPrice(product.offers) ?? offerPrice(variant?.offers),
      imageUrl: asImage(product.image) ?? asImage(variant?.image),
      color: asText(product.color) ?? asText(variant?.color),
      material: asText(product.material) ?? asText(variant?.material),
      category: asText(product.category),
      description: asText(product.description),
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
  options?: ({ name: string; values?: string[] } | string)[];
  variants?: { id: number; options?: string[] }[];
};

// The color of the variant in the link (?variant=123), or the first color option.
function shopifyColor(product: ShopifyProduct, url: string) {
  const index = (product.options ?? []).findIndex((option) =>
    /colou?r/i.test(typeof option === 'string' ? option : option.name),
  );
  if (index === -1) return null;
  const variantId = Number(url.match(/[?&]variant=(\d+)/)?.[1]);
  const variant = product.variants?.find((entry) => entry.id === variantId);
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
      imageUrl: product.featured_image ?? product.images?.[0] ?? null,
      color: shopifyColor(product, url),
      category: product.type || null,
      description: product.description ?? null,
      keywords: typeof product.tags === 'string' ? product.tags.split(',') : (product.tags ?? []),
    };
  } catch {
    return null;
  }
}

function merge(primary: LinkProduct | null, fallback: LinkProduct): LinkProduct {
  return {
    name: primary?.name ?? fallback.name,
    brand: primary?.brand ?? fallback.brand,
    price: primary?.price ?? fallback.price,
    imageUrl: primary?.imageUrl ?? fallback.imageUrl,
    color: primary?.color ?? fallback.color,
    material: primary?.material ?? fallback.material,
    category: primary?.category ?? fallback.category,
    description: primary?.description ?? fallback.description,
    keywords: [...(primary?.keywords ?? []), ...(fallback.keywords ?? [])],
  };
}

// Reads a product's name, brand, price and image from a shop link, using the
// page's JSON-LD, then Open Graph / Twitter / microdata tags, then Shopify's
// product JSON. `text` can be anything containing a link, like shared text.
export async function importFromLink(text: string): Promise<LinkImportResult> {
  const url = extractLink(text);
  if (!url) return { ok: false, reason: 'no-link' };

  let html = '';
  let blocked = false;
  try {
    const response = await fetchWithTimeout(url, BROWSER_HEADERS);
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
    imageUrl: metaContent(html, 'og:image:secure_url', 'og:image', 'twitter:image', 'image'),
    color: metaContent(html, 'product:color', 'og:color', 'color'),
    material: metaContent(html, 'product:material', 'material'),
    category: metaContent(html, 'product:category', 'category'),
    description: metaContent(html, 'og:description', 'description', 'twitter:description'),
    keywords: metaContent(html, 'keywords')?.split(',') ?? [],
  };
  let product = merge(jsonLdProduct(html), fromTags);

  // Shopify's product JSON also has the product type, tags and colour options.
  const shopify = await shopifyProduct(url);
  if (shopify) product = merge(shopify, product);

  // A bot-check or empty JavaScript shell page has a title but no product image.
  if (!product.imageUrl && !product.price) {
    return { ok: false, reason: blocked ? 'blocked' : 'no-data' };
  }
  return { ok: true, product: finish(product, url) };
}

function pageTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeEntities(title.replace(/\s+/g, ' ')) : null;
}

function finish(product: LinkProduct, url: string): LinkProduct {
  return {
    ...product,
    // Page titles often end in " | Shop name".
    name: product.name?.replace(/\s+\|\s+[^|]+$/, '').trim() || product.name,
    imageUrl: product.imageUrl ? absoluteUrl(product.imageUrl, url) : null,
  };
}
