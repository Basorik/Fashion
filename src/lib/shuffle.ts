import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category } from '@/constants/categories';
import { listItems, type ItemWithStats } from '@/lib/db';

// The pieces a shuffled outfit is built from, top to toe.
export const ShuffleSlots = [
  'Outerwear',
  'Tops',
  'Dresses',
  'Bottoms',
  'Shoes',
  'Accessories',
] as const;

export type ShuffleSlot = (typeof ShuffleSlots)[number] & Category;

export const SlotLabels: Record<ShuffleSlot, string> = {
  Outerwear: 'Layer',
  Tops: 'Top',
  Dresses: 'Dress',
  Bottoms: 'Bottom',
  Shoes: 'Shoes',
  Accessories: 'Accessory',
};

export type ShufflePool = Record<ShuffleSlot, ItemWithStats[]>;

// Items that can be worn right now (not in the wash, lent out or archived), by slot.
export async function loadShufflePool(db: SQLiteDatabase): Promise<ShufflePool> {
  const items = await listItems(db);
  const pool = Object.fromEntries(ShuffleSlots.map((slot) => [slot, []])) as unknown as ShufflePool;
  for (const item of items) {
    if (item.status || item.archivedAt) continue;
    if ((ShuffleSlots as readonly string[]).includes(item.category)) {
      pool[item.category as ShuffleSlot].push(item);
    }
  }
  return pool;
}

// A random item for the slot, different from the current one when there's a choice.
export function pickFor(pool: ShufflePool, slot: ShuffleSlot, current?: ItemWithStats | null) {
  const choices = pool[slot].filter((item) => item.id !== current?.id);
  if (choices.length === 0) return current ?? null;
  return choices[Math.floor(Math.random() * choices.length)];
}
