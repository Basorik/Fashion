export type LinkProduct = {
  name: string | null;
  brand: string | null;
  price: number | null;
  imageUrl: string | null;
};

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function metaContent(html: string, key: string) {
  // Matches <meta property|name="key" content="..."> in either attribute order.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

type JsonLdProduct = {
  '@type'?: string | string[];
  name?: string;
  image?: string | string[] | { url?: string };
  brand?: string | { name?: string };
  offers?: { price?: string | number } | { price?: string | number }[];
};

// Finds a schema.org Product in the page's JSON-LD, which most shops include.
function jsonLdProduct(html: string): JsonLdProduct | null {
  const scripts = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const body = script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const parsed = JSON.parse(body) as unknown;
      const nodes = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((node) =>
        node && typeof node === 'object' && '@graph' in node ? (node as { '@graph': unknown[] })['@graph'] : [node]
      ) as JsonLdProduct[];
      const product = nodes.find((node) =>
        [node?.['@type']].flat().some((type) => type === 'Product')
      );
      if (product) return product;
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return null;
}

function toPrice(value: unknown) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Reads the product name, brand, price and image from a shop page's
// structured data (JSON-LD) or Open Graph tags. Returns null if the page
// can't be fetched or has neither.
export async function importFromLink(url: string): Promise<LinkProduct | null> {
  try {
    const response = await fetch(url, { headers: { Accept: 'text/html' } });
    if (!response.ok) return null;
    const html = await response.text();
    const product = jsonLdProduct(html);

    const ldImage = product?.image;
    const image =
      typeof ldImage === 'string' ? ldImage : Array.isArray(ldImage) ? ldImage[0] : ldImage?.url;
    const ldBrand = product?.brand;
    const offer = Array.isArray(product?.offers) ? product?.offers[0] : product?.offers;

    const result: LinkProduct = {
      name: product?.name?.trim() || metaContent(html, 'og:title'),
      brand:
        (typeof ldBrand === 'string' ? ldBrand : ldBrand?.name) ??
        metaContent(html, 'product:brand') ??
        metaContent(html, 'og:site_name'),
      price: toPrice(offer?.price) ?? toPrice(metaContent(html, 'product:price:amount')),
      imageUrl: image ?? metaContent(html, 'og:image'),
    };
    if (result.imageUrl && !/^https:/i.test(result.imageUrl)) {
      result.imageUrl = result.imageUrl.startsWith('//')
        ? `https:${result.imageUrl}`
        : new URL(result.imageUrl, url).toString();
    }
    return result.name || result.imageUrl ? result : null;
  } catch {
    return null;
  }
}
