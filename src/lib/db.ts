import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category } from '@/constants/categories';
import type { Tag } from '@/constants/tags';
import { toDateString } from '@/lib/dates';

export const DATABASE_NAME = 'bella.db';

export type Item = {
  id: number;
  name: string;
  category: Category;
  brand: string | null;
  price: number | null;
  // Photo file name (see lib/photos). Null for items added by hand without a photo.
  photo: string | null;
  barcode: string | null;
  createdAt: string;
};

export type ItemWithStats = Item & {
  wearCount: number;
  lastWorn: string | null;
  // The item's tag values separated by spaces, for search.
  tagText: string | null;
};

export type ItemInput = Pick<
  Item,
  'name' | 'category' | 'brand' | 'price' | 'photo' | 'barcode'
> & {
  tags: Tag[];
};

// Applies one schema upgrade and records its version in the same transaction,
// so an upgrade interrupted by a crash is rolled back and simply runs again.
async function upgrade(db: SQLiteDatabase, version: number, sql: string) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(sql);
    await db.execAsync(`PRAGMA user_version = ${version}`);
  });
}

// Runs once when the app opens. Each block upgrades the schema by one version,
// so existing users keep their data when new tables or columns are added.
export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await upgrade(
      db,
      1,
      `
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
    `,
    );
    version = 1;
  }

  if (version < 2) {
    // An outfit wear logs one row in outfit_wears plus one row in wears per item,
    // linked by outfit_wear_id so undoing the outfit wear removes the item wears too.
    await upgrade(
      db,
      2,
      `
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
    `,
    );
    version = 2;
  }

  if (version < 3) {
    // Makes photo optional (items can be added by hand), adds brand and barcode,
    // and moves the old free-text color into the new tags table. SQLite can't
    // change a column's NOT NULL, so the items table is rebuilt. Foreign keys are
    // switched off during the rebuild so dropping the old table doesn't cascade
    // (SQLite ignores that switch inside a transaction, so it wraps the upgrade).
    await db.execAsync('PRAGMA foreign_keys = OFF');
    try {
      await upgrade(
        db,
        3,
        `
        CREATE TABLE items_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          brand TEXT,
          price REAL,
          photo TEXT,
          barcode TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO items_new (id, name, category, price, photo, created_at)
          SELECT id, name, category, price, photo, created_at FROM items;
        CREATE TABLE item_tags (
          item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          tag_group TEXT NOT NULL,
          value TEXT NOT NULL,
          PRIMARY KEY (item_id, tag_group, value)
        );
        INSERT INTO item_tags (item_id, tag_group, value)
          SELECT id, 'Color', trim(color) FROM items WHERE trim(coalesce(color, '')) != '';
        DROP TABLE items;
        ALTER TABLE items_new RENAME TO items;
        CREATE INDEX item_tags_value ON item_tags(tag_group, value);
      `,
      );
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON');
    }
    version = 3;
  }

  if (version < 4) {
    await upgrade(
      db,
      4,
      `
      CREATE TABLE plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        planned_on TEXT NOT NULL,
        outfit_id INTEGER NOT NULL REFERENCES outfits(id) ON DELETE CASCADE
      );
      CREATE INDEX plans_planned_on ON plans(planned_on);

      CREATE TABLE wishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        brand TEXT,
        price REAL,
        url TEXT,
        photo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE wish_tags (
        wish_id INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
        tag_group TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (wish_id, tag_group, value)
      );

      CREATE TABLE trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_on TEXT,
        end_on TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE trip_items (
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        packed INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (trip_id, item_id)
      );

      -- Where each item sits on the outfit board, as fractions of the board size.
      ALTER TABLE outfit_items ADD COLUMN x REAL;
      ALTER TABLE outfit_items ADD COLUMN y REAL;
      ALTER TABLE outfit_items ADD COLUMN scale REAL;
    `,
    );
    version = 4;
  }
}

const itemWithStatsQuery = `
  SELECT
    items.id,
    items.name,
    items.category,
    items.brand,
    items.price,
    items.photo,
    items.barcode,
    items.created_at AS createdAt,
    COUNT(wears.id) AS wearCount,
    MAX(wears.worn_on) AS lastWorn,
    (SELECT group_concat(value, ' ') FROM item_tags WHERE item_id = items.id) AS tagText
  FROM items
  LEFT JOIN wears ON wears.item_id = items.id
`;

export function listItems(db: SQLiteDatabase, category?: Category) {
  if (category) {
    return db.getAllAsync<ItemWithStats>(
      `${itemWithStatsQuery} WHERE items.category = ? GROUP BY items.id ORDER BY items.id DESC`,
      category,
    );
  }
  return db.getAllAsync<ItemWithStats>(
    `${itemWithStatsQuery} GROUP BY items.id ORDER BY items.id DESC`,
  );
}

export function getItem(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ItemWithStats>(
    `${itemWithStatsQuery} WHERE items.id = ? GROUP BY items.id`,
    id,
  );
}

export function listItemTags(db: SQLiteDatabase, itemId: number) {
  return db.getAllAsync<Tag>(
    'SELECT tag_group AS "group", value FROM item_tags WHERE item_id = ? ORDER BY tag_group, value',
    itemId,
  );
}

async function replaceTags(db: SQLiteDatabase, itemId: number, tags: Tag[]) {
  await db.runAsync('DELETE FROM item_tags WHERE item_id = ?', itemId);
  for (const tag of tags) {
    await db.runAsync(
      'INSERT OR IGNORE INTO item_tags (item_id, tag_group, value) VALUES (?, ?, ?)',
      itemId,
      tag.group,
      tag.value,
    );
  }
}

// Inserts an item and its tags. Call inside a transaction.
export async function insertItem(db: SQLiteDatabase, item: ItemInput) {
  const result = await db.runAsync(
    'INSERT INTO items (name, category, brand, price, photo, barcode) VALUES (?, ?, ?, ?, ?, ?)',
    item.name,
    item.category,
    item.brand,
    item.price,
    item.photo,
    item.barcode,
  );
  await replaceTags(db, result.lastInsertRowId, item.tags);
  return result.lastInsertRowId;
}

export async function addItem(db: SQLiteDatabase, item: ItemInput) {
  let itemId = 0;
  await db.withTransactionAsync(async () => {
    itemId = await insertItem(db, item);
  });
  return itemId;
}

export async function updateItem(db: SQLiteDatabase, id: number, item: ItemInput) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE items SET name = ?, category = ?, brand = ?, price = ?, photo = ?, barcode = ? WHERE id = ?',
      item.name,
      item.category,
      item.brand,
      item.price,
      item.photo,
      item.barcode,
      id,
    );
    await replaceTags(db, id, item.tags);
  });
}

export async function deleteItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
}

export function today() {
  return toDateString(new Date());
}

export async function logWear(db: SQLiteDatabase, itemId: number, wornOn = today()) {
  await db.runAsync('INSERT INTO wears (item_id, worn_on) VALUES (?, ?)', itemId, wornOn);
}

// Removes the item's wear on `wornOn`, preferring one logged on its own over
// one that came from an outfit.
export async function undoWear(db: SQLiteDatabase, itemId: number, wornOn = today()) {
  await db.runAsync(
    `DELETE FROM wears WHERE id = (
       SELECT id FROM wears WHERE item_id = ? AND worn_on = ?
       ORDER BY outfit_wear_id IS NULL DESC, id DESC LIMIT 1
     )`,
    itemId,
    wornOn,
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
    limit,
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
        WHERE outfit_items.outfit_id = outfits.id AND items.photo IS NOT NULL
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
    outfitId,
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
        position,
      );
    }
  });
  return outfitId;
}

// Renames an outfit and sets its items, in order. Items that stay keep their board position.
export async function updateOutfit(
  db: SQLiteDatabase,
  outfitId: number,
  name: string,
  itemIds: number[],
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE outfits SET name = ? WHERE id = ?', name, outfitId);
    await db.runAsync(
      `DELETE FROM outfit_items WHERE outfit_id = ? AND item_id NOT IN (SELECT value FROM json_each(?))`,
      outfitId,
      JSON.stringify(itemIds),
    );
    for (const [position, itemId] of itemIds.entries()) {
      await db.runAsync(
        `INSERT INTO outfit_items (outfit_id, item_id, position) VALUES (?, ?, ?)
         ON CONFLICT (outfit_id, item_id) DO UPDATE SET position = excluded.position`,
        outfitId,
        itemId,
        position,
      );
    }
  });
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
      wornOn,
    );
    await db.runAsync(
      `INSERT INTO wears (item_id, worn_on, outfit_wear_id)
       SELECT item_id, ?, ? FROM outfit_items
       WHERE outfit_id = ?
         AND item_id NOT IN (SELECT item_id FROM wears WHERE worn_on = ?)`,
      wornOn,
      result.lastInsertRowId,
      outfitId,
      wornOn,
    );
  });
}

// Removes the outfit's wear on `wornOn`; its item wears go with it (see logOutfitWear).
export async function undoOutfitWear(db: SQLiteDatabase, outfitId: number, wornOn = today()) {
  await db.runAsync(
    `DELETE FROM outfit_wears WHERE id = (
       SELECT id FROM outfit_wears WHERE outfit_id = ? AND worn_on = ? ORDER BY id DESC LIMIT 1
     )`,
    outfitId,
    wornOn,
  );
}
