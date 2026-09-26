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

const SCHEMA_VERSION = 1;

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
