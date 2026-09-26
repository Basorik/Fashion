import { File, Paths } from 'expo-file-system';

import BellaVision from '../../modules/bella-vision';
import type { Category } from '@/constants/categories';
import type { Tag } from '@/constants/tags';
import { photoColorTags } from '@/lib/photo-colors';
import { inferCategory, inferTags, mergeTags } from '@/lib/tag-inference';

// Photo tools that run on the phone: Apple Vision on iOS, Google ML Kit on
// Android. They need the app's own development build; in Expo Go the native
// module is missing, so only the JavaScript color tagging runs.

export const canRemoveBackground = BellaVision?.canRemoveBackground ?? false;
export const canLabelPhotos = BellaVision !== null;

// Labels below this are too often wrong to act on.
const MIN_CONFIDENCE = 0.3;

// Spellings in the Vision and ML Kit label sets that the tag dictionaries write differently.
const LABEL_ALIASES: Record<string, string> = {
  tshirt: 't-shirt',
  jean: 'jeans',
  sneaker: 'sneakers',
  sunglass: 'sunglasses',
};

// Labels that say nothing about the item but would match a tag word
// ("pattern" would tag every photo as a print).
const GENERIC_LABELS = new Set(['pattern', 'textile', 'design', 'fashion design']);

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

export async function photoLabels(uri: string): Promise<string[]> {
  if (!BellaVision) return [];
  try {
    const labels = await BellaVision.labelImageAsync(await localFile(uri));
    return labels
      .filter((label) => label.confidence >= MIN_CONFIDENCE)
      .map(({ label }) => {
        const lower = label.toLowerCase();
        return LABEL_ALIASES[lower] ?? lower;
      });
  } catch {
    return [];
  }
}

// Category and tags suggested from labels, which come most likely first. The
// category is the first label that names one, so a confident "jeans" beats a
// doubtful "shoe" in the corner. Colors aren't taken from labels; the pixel
// colors are more reliable.
export function suggestionsFromLabels(labels: string[]): {
  category: Category | null;
  tags: Tag[];
} {
  let category: Category | null = null;
  for (const label of labels) {
    category = inferCategory({ category: label });
    if (category) break;
  }
  const words = labels.filter((label) => !GENERIC_LABELS.has(label));
  const tags = inferTags({ keywords: words, material: words.join(', ') }).filter(
    (tag) => tag.group !== 'Color',
  );
  return { category, tags };
}

export type PhotoSuggestions = { category: Category | null; tags: Tag[] };

// Everything the phone can tell about an item from its photo: its main colors
// (skipped when `withColors` is false) plus, in the development build, a
// category and tags from the photo's labels.
export async function analyzePhoto(uri: string, withColors: boolean): Promise<PhotoSuggestions> {
  const [colors, labels] = await Promise.all([
    withColors ? photoColorTags(uri) : Promise.resolve([]),
    photoLabels(uri),
  ]);
  const fromLabels = suggestionsFromLabels(labels);
  return { category: fromLabels.category, tags: mergeTags(colors, fromLabels.tags) };
}
