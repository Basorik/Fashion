import { Directory, File, Paths } from 'expo-file-system';

// Photos live in the app's document directory. The database stores only the
// file name, because the absolute document path can change between app updates.
export function photosDir() {
  return new Directory(Paths.document, 'photos');
}

// Copies a picked photo (a local file URI) or downloads a product image
// (an http(s) URL) into the photos folder, returning the stored file name.
// Cut-outs (transparent PNGs of just the item) are marked in the name so
// they can be shown whole instead of cropped to fill.
export async function savePhoto(
  sourceUri: string,
  { cutout = false }: { cutout?: boolean } = {},
): Promise<string> {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const isRemote = /^https?:/i.test(sourceUri);
  const extension = (isRemote ? null : new File(sourceUri).extension) || '.jpg';
  const destination = new File(
    dir,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${cutout ? CUTOUT_SUFFIX : extension}`,
  );
  if (isRemote) {
    await File.downloadFileAsync(sourceUri, destination);
  } else {
    await new File(sourceUri).copy(destination);
  }
  return destination.name;
}

const CUTOUT_SUFFIX = '-cutout.png';

export function isCutout(name: string) {
  return name.endsWith(CUTOUT_SUFFIX);
}

export function photoUri(name: string): string {
  return new File(photosDir(), name).uri;
}

export function deletePhoto(name: string) {
  const file = new File(photosDir(), name);
  if (file.exists) {
    file.delete();
  }
}
