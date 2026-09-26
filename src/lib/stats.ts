import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays } from '@/lib/dates';
import { today, type Item } from '@/lib/db';

type RankedItem = Pick<Item, 'id' | 'name' | 'photo'> & {
  wearCount: number;
  lastWorn: string | null;
};

// Counts only items still in the wardrobe, except spending, which includes
// items since removed because the money was spent either way.
export type WardrobeStats = {
  itemCount: number;
  outfitCount: number;
  wearsLast30Days: number;
  totalValue: number;
  avgCostPerWear: number | null;
  mostWorn: RankedItem[];
  leastWorn: RankedItem[];
  byCategory: { label: string; count: number }[];
  byColor: { label: string; count: number }[];
  // Money spent on items, by the month they were added.
  spendingByMonth: { label: string; amount: number }[];
  // Share of items worn at least once in the last 90 days.
  activeShare: number;
};

const rankedQuery = `
  SELECT items.id, items.name, items.photo,
    COUNT(wears.id) AS wearCount, MAX(wears.worn_on) AS lastWorn
  FROM items LEFT JOIN wears ON wears.item_id = items.id
  WHERE items.removed_on IS NULL
  GROUP BY items.id
`;

export async function getWardrobeStats(db: SQLiteDatabase): Promise<WardrobeStats> {
  const now = today();
  const [totals, mostWorn, leastWorn, byCategory, byColor, spending, active] = await Promise.all([
    db.getFirstAsync<{
      itemCount: number;
      outfitCount: number;
      wearsLast30Days: number;
      totalValue: number | null;
      pricedWears: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM items WHERE removed_on IS NULL) AS itemCount,
        (SELECT COUNT(*) FROM outfits) AS outfitCount,
        (SELECT COUNT(DISTINCT worn_on) FROM wears WHERE worn_on > ?) AS wearsLast30Days,
        (SELECT SUM(price) FROM items WHERE removed_on IS NULL) AS totalValue,
        (SELECT COUNT(*) FROM wears JOIN items ON items.id = wears.item_id
          WHERE items.price IS NOT NULL AND items.removed_on IS NULL) AS pricedWears`,
      addDays(now, -30),
    ),
    db.getAllAsync<RankedItem>(
      `${rankedQuery} HAVING wearCount > 0 ORDER BY wearCount DESC, lastWorn DESC LIMIT 5`,
    ),
    // Never-worn items first, then the ones worn longest ago.
    db.getAllAsync<RankedItem>(
      `${rankedQuery} ORDER BY lastWorn IS NOT NULL, lastWorn ASC, wearCount ASC LIMIT 5`,
    ),
    db.getAllAsync<{ label: string; count: number }>(
      `SELECT category AS label, COUNT(*) AS count FROM items WHERE removed_on IS NULL
       GROUP BY category ORDER BY count DESC`,
    ),
    db.getAllAsync<{ label: string; count: number }>(
      `SELECT value AS label, COUNT(*) AS count FROM item_tags
       JOIN items ON items.id = item_tags.item_id
       WHERE tag_group = 'Color' AND items.removed_on IS NULL
       GROUP BY value ORDER BY count DESC LIMIT 8`,
    ),
    db.getAllAsync<{ label: string; amount: number }>(
      `SELECT substr(created_at, 1, 7) AS label, SUM(price) AS amount FROM items
       WHERE price IS NOT NULL AND created_at >= ?
       GROUP BY label ORDER BY label`,
      addDays(now, -365),
    ),
    db.getFirstAsync<{ share: number | null }>(
      `SELECT CAST(COUNT(DISTINCT wears.item_id) AS REAL) /
         NULLIF((SELECT COUNT(*) FROM items WHERE removed_on IS NULL), 0) AS share
       FROM wears JOIN items ON items.id = wears.item_id
       WHERE worn_on > ? AND items.removed_on IS NULL`,
      addDays(now, -90),
    ),
  ]);

  const totalValue = totals?.totalValue ?? 0;
  const pricedWears = totals?.pricedWears ?? 0;
  return {
    itemCount: totals?.itemCount ?? 0,
    outfitCount: totals?.outfitCount ?? 0,
    wearsLast30Days: totals?.wearsLast30Days ?? 0,
    totalValue,
    avgCostPerWear: pricedWears > 0 ? totalValue / pricedWears : null,
    mostWorn,
    leastWorn,
    byCategory,
    byColor,
    spendingByMonth: spending,
    activeShare: active?.share ?? 0,
  };
}
