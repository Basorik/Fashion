import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category } from '@/constants/categories';

export type Trip = {
  id: number;
  name: string;
  startOn: string | null;
  endOn: string | null;
  itemCount: number;
  packedCount: number;
};

export type PackingItem = {
  id: number;
  name: string;
  photo: string | null;
  category: Category;
  packed: boolean;
};

const tripQuery = `
  SELECT trips.id, trips.name, trips.start_on AS startOn, trips.end_on AS endOn,
    COUNT(trip_items.item_id) AS itemCount,
    COALESCE(SUM(trip_items.packed), 0) AS packedCount
  FROM trips LEFT JOIN trip_items ON trip_items.trip_id = trips.id
`;

export function listTrips(db: SQLiteDatabase) {
  return db.getAllAsync<Trip>(
    `${tripQuery} GROUP BY trips.id ORDER BY trips.start_on IS NULL, trips.start_on DESC, trips.id DESC`,
  );
}

export function getTrip(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Trip>(`${tripQuery} WHERE trips.id = ? GROUP BY trips.id`, id);
}

export async function addTrip(
  db: SQLiteDatabase,
  name: string,
  startOn: string | null,
  endOn: string | null,
) {
  const result = await db.runAsync(
    'INSERT INTO trips (name, start_on, end_on) VALUES (?, ?, ?)',
    name,
    startOn,
    endOn,
  );
  return result.lastInsertRowId;
}

export async function deleteTrip(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM trips WHERE id = ?', id);
}

export async function listPackingItems(db: SQLiteDatabase, tripId: number) {
  const rows = await db.getAllAsync<Omit<PackingItem, 'packed'> & { packed: number }>(
    `SELECT items.id, items.name, items.photo, items.category, trip_items.packed
     FROM trip_items JOIN items ON items.id = trip_items.item_id
     WHERE trip_items.trip_id = ?
     ORDER BY items.category, items.name`,
    tripId,
  );
  return rows.map((row) => ({ ...row, packed: row.packed === 1 }));
}

export async function addTripItems(db: SQLiteDatabase, tripId: number, itemIds: number[]) {
  await db.withTransactionAsync(async () => {
    for (const itemId of itemIds) {
      await db.runAsync(
        'INSERT OR IGNORE INTO trip_items (trip_id, item_id) VALUES (?, ?)',
        tripId,
        itemId,
      );
    }
  });
}

// Adds every item from an outfit; items already on the list are left as they are.
export async function addTripOutfit(db: SQLiteDatabase, tripId: number, outfitId: number) {
  await db.runAsync(
    `INSERT OR IGNORE INTO trip_items (trip_id, item_id)
     SELECT ?, item_id FROM outfit_items WHERE outfit_id = ?`,
    tripId,
    outfitId,
  );
}

export async function setPacked(
  db: SQLiteDatabase,
  tripId: number,
  itemId: number,
  packed: boolean,
) {
  await db.runAsync(
    'UPDATE trip_items SET packed = ? WHERE trip_id = ? AND item_id = ?',
    packed ? 1 : 0,
    tripId,
    itemId,
  );
}

export async function removeTripItem(db: SQLiteDatabase, tripId: number, itemId: number) {
  await db.runAsync('DELETE FROM trip_items WHERE trip_id = ? AND item_id = ?', tripId, itemId);
}
