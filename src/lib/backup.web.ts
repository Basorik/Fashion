import { backupDatabaseAsync, deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { unzipSync, zipSync, type Zippable } from 'fflate';

import { migrate } from '@/lib/db';
import { listPhotos, replacePhotos } from '@/lib/photos.web';

// The web version of lib/backup. It writes and reads the same zip format, so
// a backup made in the browser restores on the phone and the other way round.
// The browser downloads the file instead of asking for a folder, and the zip
// is built in memory, since browsers can't write to a file bit by bit.

const MANIFEST = 'bella-backup.json';
const DATABASE = 'bella.db';
const PHOTOS = 'photos/';
const FORMAT = 1;

type Manifest = {
  app: 'bella';
  format: number;
  schemaVersion: number;
  createdAt: string;
};

export type BackupSummary = {
  createdAt: string;
  items: number;
  outfits: number;
  photos: number;
};

export type PendingRestore = {
  summary: BackupSummary;
  database: SQLiteDatabase;
  photos: { name: string; blob: Blob }[];
};

async function schemaVersion(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

// See lib/backup: a WAL-flagged copy can't be opened in memory.
function clearWalFlag(bytes: Uint8Array) {
  bytes[18] = 1;
  bytes[19] = 1;
  return bytes;
}

export function backupFileName(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Bella backup ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}

function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Builds the backup and hands it to the browser as a download.
export async function exportBackup(
  db: SQLiteDatabase,
  onProgress?: (done: number, total: number) => void,
): Promise<string | null> {
  const manifest: Manifest = {
    app: 'bella',
    format: FORMAT,
    schemaVersion: await schemaVersion(db),
    createdAt: new Date().toISOString(),
  };
  const files: Zippable = {
    [MANIFEST]: new TextEncoder().encode(JSON.stringify(manifest)),
    [DATABASE]: [clearWalFlag(await db.serializeAsync()), { level: 6 }],
  };
  const photos = await listPhotos();
  for (const [index, photo] of photos.entries()) {
    onProgress?.(index, photos.length);
    // Photos are already compressed, so they are stored as they are.
    files[PHOTOS + photo.name] = [new Uint8Array(await photo.blob.arrayBuffer()), { level: 0 }];
  }
  onProgress?.(photos.length, photos.length);
  const name = backupFileName();
  download(zipSync(files), name);
  return name;
}

// Opens the browser's file picker. Resolves with null if it's closed without a file.
function pickFile() {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

const photoTypes: Record<string, string> = { png: 'image/png', webp: 'image/webp' };

// Only plain file names inside photos/ are read, as on the phone.
function photoName(path: string) {
  if (!path.startsWith(PHOTOS)) return null;
  const name = path.slice(PHOTOS.length);
  return name && !name.includes('/') && !name.includes('\\') && !name.startsWith('.')
    ? name
    : null;
}

// Asks for a backup file, checks it and upgrades its data to the current
// schema. Nothing in the app changes until applyRestore.
export async function readBackup(db: SQLiteDatabase): Promise<PendingRestore | null> {
  const file = await pickFile();
  if (!file) return null;

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("This file isn't a Bella backup, or it's damaged.");
  }
  if (!entries[MANIFEST] || !entries[DATABASE]) throw new Error("This file isn't a Bella backup.");
  const manifest = JSON.parse(new TextDecoder().decode(entries[MANIFEST])) as Manifest;
  if (manifest.app !== 'bella') throw new Error("This file isn't a Bella backup.");
  if (manifest.format > FORMAT || manifest.schemaVersion > (await schemaVersion(db))) {
    throw new Error('This backup was made by a newer version of Bella. Update the app first.');
  }

  const photos: PendingRestore['photos'] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    const name = photoName(path);
    if (!name) continue;
    const type = photoTypes[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/jpeg';
    photos.push({ name, blob: new Blob([bytes as BlobPart], { type }) });
  }

  const database = await deserializeDatabaseAsync(clearWalFlag(entries[DATABASE]));
  try {
    await migrate(database);
    const count = async (table: string) =>
      (await database.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;
    const summary: BackupSummary = {
      createdAt: manifest.createdAt,
      items: await count('items'),
      outfits: await count('outfits'),
      photos: photos.length,
    };
    return { summary, database, photos };
  } catch (error) {
    await database.closeAsync();
    throw error;
  }
}

export async function discardRestore(pending: PendingRestore) {
  await pending.database.closeAsync();
}

// Replaces everything in the app with the backup.
export async function applyRestore(db: SQLiteDatabase, pending: PendingRestore) {
  try {
    await backupDatabaseAsync({ sourceDatabase: pending.database, destDatabase: db });
    await replacePhotos(pending.photos);
  } finally {
    await discardRestore(pending);
  }
}
