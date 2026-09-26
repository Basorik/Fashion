import { File, Paths } from 'expo-file-system';

import BellaVision, { type ImageLabel } from '../../modules/bella-vision';
import type { Category } from '@/constants/categories';
import type { Tag } from '@/constants/tags';
import { mergeTags } from '@/lib/tag-inference';

// Photo tools that run on the phone: Apple Vision on iOS, Google ML Kit on
// Android. They need the app's own development build; in Expo Go the native
// module is missing, so only the JavaScript color tagging runs.

export const canRemoveBackground = BellaVision?.canRemoveBackground ?? false;
export const canLabelPhotos = BellaVision !== null;

// Photo labels the app acts on, and what each means. General-purpose label
// sets say plenty that's true of the photo but not of the item ("sleeve",
// "jersey", "flower" on a patterned wall), so anything not listed is ignored.
const LABEL_MEANINGS: Record<string, { category?: Category; tag?: Tag }> = {};

function means(labels: string[], meaning: { category?: Category; tag?: Tag }) {
  for (const label of labels) LABEL_MEANINGS[label] = meaning;
}

means(['jeans', 'jean', 'pants', 'trousers', 'shorts', 'skirt', 'miniskirt', 'leggings'], {
  category: 'Bottoms',
});
means(
  [
    'shirt',
    't-shirt',
    'tshirt',
    'blouse',
    'sweater',
    'sweatshirt',
    'hoodie',
    'cardigan',
    'polo shirt',
    'tank top',
  ],
  { category: 'Tops' },
);
means(['dress', 'gown', 'sundress', 'wedding dress'], { category: 'Dresses' });
means(
  [
    'jacket',
    'coat',
    'blazer',
    'parka',
    'raincoat',
    'overcoat',
    'trench coat',
    'outerwear',
    'vest',
    'suit',
  ],
  {
    category: 'Outerwear',
  },
);
means(
  [
    'shoe',
    'shoes',
    'sneaker',
    'sneakers',
    'boot',
    'boots',
    'sandal',
    'sandals',
    'footwear',
    'high heels',
    'loafer',
    'slipper',
  ],
  { category: 'Shoes' },
);
means(
  [
    'bag',
    'handbag',
    'backpack',
    'purse',
    'hat',
    'cap',
    'sunglasses',
    'sunglass',
    'scarf',
    'belt',
    'watch',
    'necklace',
    'bracelet',
    'earrings',
    'tie',
    'bowtie',
    'glove',
    'gloves',
    'jewelry',
  ],
  { category: 'Accessories' },
);
means(['denim'], { tag: { group: 'Material', value: 'Denim' } });
means(['leather'], { tag: { group: 'Material', value: 'Leather' } });
means(['wool', 'knitwear', 'knitting'], { tag: { group: 'Material', value: 'Wool' } });
means(['silk', 'satin'], { tag: { group: 'Material', value: 'Silk' } });
means(['plaid', 'tartan', 'checkered', 'gingham'], { tag: { group: 'Pattern', value: 'Checked' } });
means(['stripes', 'striped', 'pinstripe'], { tag: { group: 'Pattern', value: 'Striped' } });
means(['floral', 'paisley'], { tag: { group: 'Pattern', value: 'Floral' } });
means(['polka dot', 'camouflage', 'leopard'], { tag: { group: 'Pattern', value: 'Print' } });

// How sure the label must be before the app acts on it. Picking the category
// is easy to fix and shown in the form; a tag is easier to miss.
const CATEGORY_CONFIDENCE = 0.5;
const TAG_CONFIDENCE = 0.7;

// The native tools read local files, so product images from a link are downloaded first.
async function localFile(uri: string) {
  if (!/^https?:/i.test(uri)) return uri;
  const destination = new File(Paths.cache, `bella-download-${Date.now()}.jpg`);
  await File.downloadFileAsync(uri, destination);
  return destination.uri;
}

export type CutoutResult =
  | { ok: true; uri: string }
  | { ok: false; reason: 'unavailable' | 'no-subject' | 'model-downloading' | 'failed' };

// Cuts the item out of the photo, returning a transparent PNG cropped to it.
export async function removeBackground(uri: string): Promise<CutoutResult> {
  if (!BellaVision || !canRemoveBackground) return { ok: false, reason: 'unavailable' };
  try {
    return { ok: true, uri: await BellaVision.removeBackgroundAsync(await localFile(uri)) };
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    if (code === 'ERR_NO_SUBJECT') return { ok: false, reason: 'no-subject' };
    // Android fetches the model through Google Play services on first use.
    if (/download/i.test(message ?? '')) return { ok: false, reason: 'model-downloading' };
    return { ok: false, reason: 'failed' };
  }
}

export async function photoLabels(uri: string): Promise<ImageLabel[]> {
  if (!BellaVision) return [];
  try {
    const labels = await BellaVision.labelImageAsync(await localFile(uri));
    return labels.map(({ label, confidence }) => ({ label: label.toLowerCase(), confidence }));
  } catch {
    return [];
  }
}

// Category and tags suggested from labels, which come most likely first. The
// category is the first known label that names one, so a confident "jeans"
// beats a doubtful "shoe" in the corner. Colors come from the pixels instead.
export function suggestionsFromLabels(labels: ImageLabel[]): {
  category: Category | null;
  tags: Tag[];
} {
  let category: Category | null = null;
  const tags: Tag[] = [];
  for (const { label, confidence } of labels) {
    const meaning = LABEL_MEANINGS[label];
    if (!meaning) continue;
    if (meaning.category && !category && confidence >= CATEGORY_CONFIDENCE) {
      category = meaning.category;
    }
    if (meaning.tag && confidence >= TAG_CONFIDENCE) tags.push(meaning.tag);
  }
  return { category, tags: mergeTags([], tags) };
}

export type PhotoSuggestions = {
  category: Category | null;
  tags: Tag[];
  // What the phone saw, for tuning in development builds.
  labels: ImageLabel[];
};

// A category and tags from the photo's labels (development build only).
export async function analyzePhoto(uri: string): Promise<PhotoSuggestions> {
  const labels = await photoLabels(uri);
  return { ...suggestionsFromLabels(labels), labels };
}
