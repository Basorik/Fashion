// The web version of lib/photos. Browsers have no app document folder, so
// photos are kept as blobs in IndexedDB, in the browser's storage for this
// site. The database stores only the name, as on the phone.
//
// Image components need a URL straight away, so loadPhotos reads every photo
// once when the app opens and keeps an object URL for each.

const DB_NAME = 'bella-photos';
const STORE = 'photos';
const CUTOUT_SUFFIX = '-cutout.png';

const urls = new Map<string, string>();

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function remember(name: string, blob: Blob) {
  const previous = urls.get(name);
  if (previous) URL.revokeObjectURL(previous);
  urls.set(name, URL.createObjectURL(blob));
}

// Every stored photo, by name. Used by the web backup.
export async function listPhotos(): Promise<{ name: string; blob: Blob }[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const photos: { name: string; blob: Blob }[] = [];
      const request = db.transaction(STORE).objectStore(STORE).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(photos);
        photos.push({ name: String(cursor.key), blob: cursor.value as Blob });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// Swaps every stored photo for these. Used by the web restore.
export async function replacePhotos(photos: { name: string; blob: Blob }[]) {
  await transact('readwrite', (store) => {
    store.clear();
    for (const photo of photos) store.put(photo.blob, photo.name);
  });
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  for (const photo of photos) remember(photo.name, photo.blob);
}

export async function loadPhotos() {
  // Ask the browser not to clear Bella's storage when the disk fills up. Some
  // browsers decide for themselves and ignore this.
  navigator.storage?.persist?.().catch(() => {});
  for (const photo of await listPhotos()) remember(photo.name, photo.blob);
}

// Stores a picked photo (a blob: or data: URL from the photo picker) or a
// product image (an http(s) URL), returning the stored name. Many shops don't
// let other sites download their images, so a product image that can't be
// fetched is kept as its web address and loaded from the shop instead.
export async function savePhoto(
  sourceUri: string,
  { cutout = false }: { cutout?: boolean } = {},
): Promise<string> {
  let blob: Blob;
  try {
    blob = await (await fetch(sourceUri)).blob();
  } catch (error) {
    if (/^https?:/i.test(sourceUri)) return sourceUri;
    throw error;
  }
  const extension = blob.type === 'image/png' ? '.png' : blob.type === 'image/webp' ? '.webp' : '.jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${cutout ? CUTOUT_SUFFIX : extension}`;
  await transact('readwrite', (store) => store.put(blob, name));
  remember(name, blob);
  return name;
}

export function isCutout(name: string) {
  return name.endsWith(CUTOUT_SUFFIX);
}

export function photoUri(name: string): string {
  if (/^https?:/i.test(name)) return name;
  return urls.get(name) ?? '';
}

export function deletePhoto(name: string) {
  const url = urls.get(name);
  if (url) URL.revokeObjectURL(url);
  urls.delete(name);
  transact('readwrite', (store) => store.delete(name)).catch(() => {});
}
