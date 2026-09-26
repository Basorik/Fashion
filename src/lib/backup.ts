import { backupDatabaseAsync, deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate';

import { migrate } from '@/lib/db';
import { photosDir } from '@/lib/photos';

// A backup is a zip file holding:
//   bella-backup.json  what's inside and which schema version made it
//   bella.db           the whole database, every table and column
//   photos/<name>      every file in the photos folder (item photos and cut-outs)
// Copying the database whole means new tables and columns are included without
// changes here, and restoring an older backup runs it through the normal migrations.

const MANIFEST = 'bella-backup.json';
const DATABASE = 'bella.db';
const PHOTOS = 'photos/';
const FORMAT = 1;
const CHUNK = 1024 * 1024;

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

// A restore that has been read and checked, waiting for the user to confirm.
export type PendingRestore = {
  summary: BackupSummary;
  database: SQLiteDatabase;
};

async function schemaVersion(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

// SQLite marks a database that uses WAL journaling in its header, and can't open
// such a copy in memory. Setting the two bytes back to 1 makes it a plain database.
function clearWalFlag(bytes: Uint8Array) {
  bytes[18] = 1;
  bytes[19] = 1;
  return bytes;
}

function isCancel(error: unknown) {
  return error instanceof Error && /cancel/i.test(error.message);
}

export function backupFileName(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Bella backup ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}

// Asks the user for a folder and writes a backup file there. Returns the file
// name, or null if the user closed the folder picker.
export async function exportBackup(
  db: SQLiteDatabase,
  onProgress?: (done: number, total: number) => void,
): Promise<string | null> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }

  const manifest: Manifest = {
    app: 'bella',
    format: FORMAT,
    schemaVersion: await schemaVersion(db),
    createdAt: new Date().toISOString(),
  };
  const database = clearWalFlag(await db.serializeAsync());
  const dir = photosDir();
  const photos = dir.exists ? dir.list().filter((entry) => entry instanceof File) : [];

  const name = backupFileName();
  const target = folder.createFile(name, 'application/zip');
  const handle = target.open(FileMode.WriteOnly);
  let failed = false;
  try {
    const zip = new Zip((error, chunk) => {
      if (error) throw error;
      handle.writeBytes(chunk);
    });
    const add = (entry: ZipDeflate | ZipPassThrough, bytes: Uint8Array) => {
      zip.add(entry);
      entry.push(bytes, true);
    };

    add(new ZipDeflate(MANIFEST), new TextEncoder().encode(JSON.stringify(manifest)));
    add(new ZipDeflate(DATABASE, { level: 6 }), database);
    // Photos are already compressed, so they are stored as they are.
    for (const [index, photo] of photos.entries()) {
      onProgress?.(index, photos.length);
      add(new ZipPassThrough(PHOTOS + photo.name), await photo.bytes());
    }
    zip.end();
    onProgress?.(photos.length, photos.length);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    handle.close();
    if (failed && target.exists) target.delete();
  }
  return name;
}

// The manifest and database are unpacked into the cache. Photos are unpacked
// next to the photos folder, so restoring swaps the folders with a rename.
function stagingDir() {
  return new Directory(Paths.cache, 'bella-restore');
}

function stagedPhotosDir() {
  return new Directory(Paths.document, 'photos-restore');
}

function clearStaging() {
  for (const dir of [stagingDir(), stagedPhotosDir()]) {
    if (dir.exists) dir.delete();
  }
}

// Only the names a backup writes are unpacked, so a crafted file can't write
// outside the staging folder.
function stagedPath(name: string): File | null {
  if (name === MANIFEST || name === DATABASE) return new File(stagingDir(), name);
  if (name.startsWith(PHOTOS)) {
    const photo = name.slice(PHOTOS.length);
    if (photo && !photo.includes('/') && !photo.includes('\\') && !photo.startsWith('.')) {
      return new File(stagedPhotosDir(), photo);
    }
  }
  return null;
}

// Streams the zip into the staging folder a chunk at a time, so large photo
// libraries don't have to fit in memory at once.
function unpack(source: File) {
  const open = new Set<FileHandle>();
  const input = source.open(FileMode.ReadOnly);
  try {
    const unzip = new Unzip((entry) => {
      const destination = stagedPath(entry.name);
      if (!destination) return;
      destination.create({ overwrite: true });
      const output = destination.open(FileMode.WriteOnly);
      open.add(output);
      entry.ondata = (error, chunk, final) => {
        if (error) throw error;
        output.writeBytes(chunk);
        if (final) {
          output.close();
          open.delete(output);
        }
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
    for (;;) {
      const chunk = input.readBytes(CHUNK);
      if (chunk.length === 0) break;
      unzip.push(chunk);
    }
    unzip.push(new Uint8Array(0), true);
  } finally {
    input.close();
    for (const output of open) output.close();
  }
}

// Asks the user for a backup file, unpacks and checks it, and upgrades its data
// to the current schema. Nothing in the app changes until applyRestore.
// Returns null if the user closed the file picker.
export async function readBackup(db: SQLiteDatabase): Promise<PendingRestore | null> {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return null;

  clearStaging();
  const staging = stagingDir();
  staging.create({ intermediates: true });
  stagedPhotosDir().create({ intermediates: true });

  try {
    try {
      unpack(picked.result);
    } catch {
      throw new Error("This file isn't a Bella backup, or it's damaged.");
    }

    const manifestFile = new File(staging, MANIFEST);
    const databaseFile = new File(staging, DATABASE);
    if (!manifestFile.exists || !databaseFile.exists) {
      throw new Error("This file isn't a Bella backup.");
    }
    const manifest = JSON.parse(await manifestFile.text()) as Manifest;
    if (manifest.app !== 'bella') throw new Error("This file isn't a Bella backup.");
    if (manifest.format > FORMAT || manifest.schemaVersion > (await schemaVersion(db))) {
      throw new Error('This backup was made by a newer version of Bella. Update the app first.');
    }

    const database = await deserializeDatabaseAsync(clearWalFlag(await databaseFile.bytes()));
    try {
      await migrate(database);
      const count = async (table: string) =>
        (await database.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;
      const summary: BackupSummary = {
        createdAt: manifest.createdAt,
        items: await count('items'),
        outfits: await count('outfits'),
        photos: stagedPhotosDir().list().length,
      };
      return { summary, database };
    } catch (error) {
      await database.closeAsync();
      throw error;
    }
  } catch (error) {
    clearStaging();
    throw error;
  }
}

export async function discardRestore(pending: PendingRestore) {
  await pending.database.closeAsync();
  clearStaging();
}

// Replaces everything in the app with the backup. Current photos are set aside
// first and put back if the database can't be replaced.
export async function applyRestore(db: SQLiteDatabase, pending: PendingRestore) {
  const current = photosDir();
  const photosName = current.name;
  const previous = new Directory(Paths.document, 'photos-before-restore');
  if (previous.exists) previous.delete();
  if (current.exists) current.rename(previous.name);

  try {
    stagedPhotosDir().rename(photosName);
    await backupDatabaseAsync({ sourceDatabase: pending.database, destDatabase: db });
  } catch (error) {
    const restored = photosDir();
    if (restored.exists) restored.delete();
    if (previous.exists) previous.rename(photosName);
    throw error;
  } finally {
    await discardRestore(pending);
  }
  if (previous.exists) previous.delete();
}
