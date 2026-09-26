import type { SQLiteDatabase } from 'expo-sqlite';

import type { Item } from '@/lib/db';

export type DayMarks = Record<string, { worn: boolean; planned: boolean }>;

// Which days between `from` and `to` (inclusive) have wears or plans.
export async function getDayMarks(db: SQLiteDatabase, from: string, to: string) {
  const [worn, planned] = await Promise.all([
    db.getAllAsync<{ day: string }>(
      'SELECT DISTINCT worn_on AS day FROM wears WHERE worn_on BETWEEN ? AND ?',
      from,
      to
    ),
    db.getAllAsync<{ day: string }>(
      'SELECT DISTINCT planned_on AS day FROM plans WHERE planned_on BETWEEN ? AND ?',
      from,
      to
    ),
  ]);
  const marks: DayMarks = {};
  for (const { day } of worn) marks[day] = { worn: true, planned: false };
  for (const { day } of planned) marks[day] = { worn: marks[day]?.worn ?? false, planned: true };
  return marks;
}

export type DayDetail = {
  items: Pick<Item, 'id' | 'name' | 'photo'>[];
  outfits: { wearId: number; outfitId: number; name: string }[];
  plans: { planId: number; outfitId: number; name: string }[];
};

export async function getDayDetail(db: SQLiteDatabase, day: string): Promise<DayDetail> {
  const [items, outfits, plans] = await Promise.all([
    db.getAllAsync<DayDetail['items'][number]>(
      `SELECT DISTINCT items.id, items.name, items.photo FROM wears
       JOIN items ON items.id = wears.item_id
       WHERE wears.worn_on = ? ORDER BY items.category, items.name`,
      day
    ),
    db.getAllAsync<DayDetail['outfits'][number]>(
      `SELECT outfit_wears.id AS wearId, outfits.id AS outfitId, outfits.name FROM outfit_wears
       JOIN outfits ON outfits.id = outfit_wears.outfit_id
       WHERE outfit_wears.worn_on = ? ORDER BY outfit_wears.id`,
      day
    ),
    db.getAllAsync<DayDetail['plans'][number]>(
      `SELECT plans.id AS planId, outfits.id AS outfitId, outfits.name FROM plans
       JOIN outfits ON outfits.id = plans.outfit_id
       WHERE plans.planned_on = ? ORDER BY plans.id`,
      day
    ),
  ]);
  return { items, outfits, plans };
}

export async function planOutfit(db: SQLiteDatabase, outfitId: number, day: string) {
  await db.runAsync('INSERT INTO plans (outfit_id, planned_on) VALUES (?, ?)', outfitId, day);
}

export async function removePlan(db: SQLiteDatabase, planId: number) {
  await db.runAsync('DELETE FROM plans WHERE id = ?', planId);
}

// Removes one logged outfit wear; its item wears are deleted by the cascade.
export async function removeOutfitWear(db: SQLiteDatabase, wearId: number) {
  await db.runAsync('DELETE FROM outfit_wears WHERE id = ?', wearId);
}
