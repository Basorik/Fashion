import { File } from 'expo-file-system';

// Asks for a file and reads it as text. Resolves with null if the picker is closed.
export async function pickTextFile(): Promise<string | null> {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return null;
  return await picked.result.text();
}
