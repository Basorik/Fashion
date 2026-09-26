export type ProductInfo = {
  name: string | null;
  brand: string | null;
  color: string | null;
  imageUrl: string | null;
};

type UpcItemDbResponse = {
  code?: string;
  items?: {
    title?: string;
    brand?: string;
    color?: string;
    images?: string[];
  }[];
};

// Looks a scanned UPC/EAN up in UPCitemdb's free trial API (no key, limited to
// about 100 lookups a day per device). Clothing coverage is patchy, so a miss or
// a network error returns null and the user fills the form in by hand.
export async function lookupBarcode(code: string): Promise<ProductInfo | null> {
  try {
    const response = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const body = (await response.json()) as UpcItemDbResponse;
    const product = body.items?.[0];
    if (!product) return null;
    return {
      name: product.title?.trim() || null,
      brand: product.brand?.trim() || null,
      color: product.color?.trim() || null,
      imageUrl: product.images?.find((url) => url.startsWith('https://')) ?? null,
    };
  } catch {
    return null;
  }
}
