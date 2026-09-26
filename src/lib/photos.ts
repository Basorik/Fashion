import { Directory, File, Paths } from 'expo-file-system';

// Photos live in the app's document directory. The database stores only the
// file name, because the absolute document path can change between app updates.
function photosDir() {
  return new Directory(Paths.document, 'photos');
}

// Copies a picked photo (a local file URI) or downloads a product image
// (an http(s) URL) into the photos folder, returning the stored file name.
export async function savePhoto(sourceUri: string): Promise<string> {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const isRemote = /^https?:/i.test(sourceUri);
  const extension = (isRemote ? null : new File(sourceUri).extension) || '.jpg';
  const destination = new File(
    dir,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`,
  );
  if (isRemote) {
    await File.downloadFileAsync(sourceUri, destination);
  } else {
    await new File(sourceUri).copy(destination);
  }
  return destination.name;
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
