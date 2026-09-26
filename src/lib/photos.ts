import { Directory, File, Paths } from 'expo-file-system';

// Photos live in the app's document directory. The database stores only the
// file name, because the absolute document path can change between app updates.
function photosDir() {
  return new Directory(Paths.document, 'photos');
}

export async function savePhoto(sourceUri: string): Promise<string> {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const extension = new File(sourceUri).extension || '.jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  await new File(sourceUri).copy(new File(dir, name));
  return name;
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
