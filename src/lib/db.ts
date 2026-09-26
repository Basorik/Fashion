import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category } from '@/constants/categories';

export const DATABASE_NAME = 'bella.db';

export type Item = {
  id: number;
  name: string;
  category: Category;
  color: string | null;
  price: number | null;
  photo: string;
  createdAt: string;
};

export type ItemWithStats = Item & {
  wearCount: number;
  lastWorn: string | null;
};

export type NewItem = Pick<Item, 'name' | 'category' | 'color' | 'price' | 'photo'>;

const SCHEMA_VERSION = 2;

// Runs once when the app opens. Each block upgrades the schema by one version,
// so existing users keep their data when new tables or columns are added.
export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        color TEXT,
        price REAL,
        photo TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE wears (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        worn_on TEXT NOT NULL
      );
      CREATE INDEX wears_item_id ON wears(item_id);
    `);
    version = 1;
  }

  if (version < 2) {
    // An outfit wear logs one row in outfit_wears plus one row in wears per item,
    // linked by outfit_wear_id so undoing the outfit wear removes the item wears too.
    await db.execAsync(`
      CREATE TABLE outfits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE outfit_items (
        outfit_id INTEGER NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        PRIMARY KEY (outfit_id, item_id)
      );
      CREATE INDEX outfit_items_item_id ON outfit_items(item_id);
      CREATE TABLE outfit_wears (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outfit_id INTEGER NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
        worn_on TEXT NOT NULL
      );
      CREATE INDEX outfit_wears_outfit_id ON outfit_wears(outfit_id);
      ALTER TABLE wears ADD COLUMN outfit_wear_id INTEGER REFERENCES outfit_wears(id) ON DELETE CASCADE;
      CREATE INDEX wears_worn_on ON wears(worn_on);
    `);
    version = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

const itemWithStatsQuery = `
  SELECT
    items.id,
    items.name,
    items.category,
    items.color,
    items.price,
    items.photo,
    items.created_at AS createdAt,
    COUNT(wears.id) AS wearCount,
    MAX(wears.worn_on) AS lastWorn
  FROM items
  LEFT JOIN wears ON wears.item_id = items.id
`;

export function listItems(db: SQLiteDatabase, category?: Category) {
  if (category) {
    return db.getAllAsync<ItemWithStats>(
      `${itemWithStatsQuery} WHERE items.category = ? GROUP BY items.id ORDER BY items.id DESC`,
      category
    );
  }
  return db.getAllAsync<ItemWithStats>(
    `${itemWithStatsQuery} GROUP BY items.id ORDER BY items.id DESC`
  );
}

export function getItem(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ItemWithStats>(
    `${itemWithStatsQuery} WHERE items.id = ? GROUP BY items.id`,
    id
  );
}

export async function addItem(db: SQLiteDatabase, item: NewItem) {
  const result = await db.runAsync(
    'INSERT INTO items (name, category, color, price, photo) VALUES (?, ?, ?, ?, ?)',
    item.name,
    item.category,
    item.color,
    item.price,
    item.photo
  );
  return result.lastInsertRowId;
}

export async function deleteItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
}

// Dates are stored as local YYYY-MM-DD so "today" matches the user's calendar.
export function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export async function logWear(db: SQLiteDatabase, itemId: number, wornOn = today()) {
  await db.runAsync('INSERT INTO wears (item_id, worn_on) VALUES (?, ?)', itemId, wornOn);
}

export async function undoLastWear(db: SQLiteDatabase, itemId: number) {
  await db.runAsync(
    'DELETE FROM wears WHERE id = (SELECT id FROM wears WHERE item_id = ? ORDER BY worn_on DESC, id DESC LIMIT 1)',
    itemId
  );
}

// Items most often worn on the same day as this one, whether logged as an outfit or not.
export function listWornWith(db: SQLiteDatabase, itemId: number, limit = 3) {
  return db.getAllAsync<Pick<Item, 'id' | 'name' | 'photo'> & { times: number }>(
    `SELECT items.id, items.name, items.photo, COUNT(DISTINCT other.worn_on) AS times
     FROM wears AS mine
     JOIN wears AS other ON other.worn_on = mine.worn_on AND other.item_id != mine.item_id
     JOIN items ON items.id = other.item_id
     WHERE mine.item_id = ?
     GROUP BY items.id
     ORDER BY times DESC, items.id DESC
     LIMIT ?`,
    itemId,
    limit
  );
}

export type Outfit = {
  id: number;
  name: string;
  createdAt: string;
  wearCount: number;
  lastWorn: string | null;
  // Up to four item photo file names, used for the outfit's collage thumbnail.
  photos: string[];
};

type OutfitRow = Omit<Outfit, 'photos'> & { photos: string | null };

const outfitQuery = `
  SELECT
    outfits.id,
    outfits.name,
    outfits.created_at AS createdAt,
    (SELECT COUNT(*) FROM outfit_wears WHERE outfit_id = outfits.id) AS wearCount,
    (SELECT MAX(worn_on) FROM outfit_wears WHERE outfit_id = outfits.id) AS lastWorn,
    (
      SELECT json_group_array(photo) FROM (
        SELECT items.photo FROM outfit_items
        JOIN items ON items.id = outfit_items.item_id
        WHERE outfit_items.outfit_id = outfits.id
        ORDER BY outfit_items.position
        LIMIT 4
      )
    ) AS photos
  FROM outfits
`;

function toOutfit(row: OutfitRow): Outfit {
  return { ...row, photos: row.photos ? (JSON.parse(row.photos) as string[]) : [] };
}

export async function listOutfits(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<OutfitRow>(`${outfitQuery} ORDER BY outfits.id DESC`);
  return rows.map(toOutfit);
}

export async function getOutfit(db: SQLiteDatabase, id: number) {
  const row = await db.getFirstAsync<OutfitRow>(`${outfitQuery} WHERE outfits.id = ?`, id);
  return row ? toOutfit(row) : null;
}

export function listOutfitItems(db: SQLiteDatabase, outfitId: number) {
  return db.getAllAsync<ItemWithStats>(
    `${itemWithStatsQuery}
     JOIN outfit_items ON outfit_items.item_id = items.id
     WHERE outfit_items.outfit_id = ?
     GROUP BY items.id
     ORDER BY outfit_items.position`,
    outfitId
  );
}

export async function addOutfit(db: SQLiteDatabase, name: string, itemIds: number[]) {
  let outfitId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync('INSERT INTO outfits (name) VALUES (?)', name);
    outfitId = result.lastInsertRowId;
    for (const [position, itemId] of itemIds.entries()) {
      await db.runAsync(
        'INSERT INTO outfit_items (outfit_id, item_id, position) VALUES (?, ?, ?)',
        outfitId,
        itemId,
        position
      );
    }
  });
  return outfitId;
}

export async function deleteOutfit(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM outfits WHERE id = ?', id);
}

// Logs the outfit as worn and adds a wear to each of its items. Items already
// logged as worn that day are skipped so a day is never counted twice.
export async function logOutfitWear(db: SQLiteDatabase, outfitId: number, wornOn = today()) {
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO outfit_wears (outfit_id, worn_on) VALUES (?, ?)',
      outfitId,
      wornOn
    );
    await db.runAsync(
      `INSERT INTO wears (item_id, worn_on, outfit_wear_id)
       SELECT item_id, ?, ? FROM outfit_items
       WHERE outfit_id = ?
         AND item_id NOT IN (SELECT item_id FROM wears WHERE worn_on = ?)`,
      wornOn,
      result.lastInsertRowId,
      outfitId,
      wornOn
    );
  });
}

export async function undoLastOutfitWear(db: SQLiteDatabase, outfitId: number) {
  await db.runAsync(
    'DELETE FROM outfit_wears WHERE id = (SELECT id FROM outfit_wears WHERE outfit_id = ? ORDER BY worn_on DESC, id DESC LIMIT 1)',
    outfitId
  );
}
