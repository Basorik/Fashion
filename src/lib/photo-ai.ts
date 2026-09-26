import { File, Paths } from 'expo-file-system';

import BellaVision from '../../modules/bella-vision';

// Background removal on the phone: Apple Vision on iOS, Google ML Kit on
// Android. It needs the app's own development build; in Expo Go the native
// module is missing, so photos keep their background.

export const canRemoveBackground = BellaVision?.canRemoveBackground ?? false;

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
