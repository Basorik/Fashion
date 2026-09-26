import { pickBrowserFile } from '@/lib/pick-browser-file';

// The web version of lib/pick-text-file, using the browser's file picker.
export async function pickTextFile(): Promise<string | null> {
  const file = await pickBrowserFile();
  return file ? await file.text() : null;
}
