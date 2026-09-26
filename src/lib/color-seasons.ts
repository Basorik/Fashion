import type { SQLiteDatabase } from 'expo-sqlite';

import { ColorSeasons, type ColorSeason } from '@/constants/color-seasons';
import { getSetting, listItems, setSetting } from '@/lib/db';
import { photoColorTags } from '@/lib/photo-colors';
import { isCutout, photoUri } from '@/lib/photos';

const MY_SEASON_KEY = 'colorSeason';

export async function getMySeason(db: SQLiteDatabase): Promise<ColorSeason | null> {
  const value = await getSetting(db, MY_SEASON_KEY);
  return ColorSeasons.find((season) => season === value) ?? null;
}

export function setMySeason(db: SQLiteDatabase, season: ColorSeason | null) {
  return setSetting(db, MY_SEASON_KEY, season);
}

export type ColorSeasonOverview = {
  mine: ColorSeason | null;
  // Wardrobe items tagged with each color season.
  counts: Record<ColorSeason, number>;
  // Wardrobe items with a photo but no color season, which can be tagged from the photo.
  untagged: number;
};

export async function getColorSeasonOverview(db: SQLiteDatabase): Promise<ColorSeasonOverview> {
  const [mine, rows, untagged] = await Promise.all([
    getMySeason(db),
    db.getAllAsync<{ season: string; count: number }>(
      `SELECT value AS season, COUNT(*) AS count FROM item_tags
       JOIN items ON items.id = item_tags.item_id
       WHERE tag_group = 'Color season' AND items.removed_on IS NULL
       GROUP BY value`,
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM items
       WHERE removed_on IS NULL AND photo IS NOT NULL
         AND id NOT IN (SELECT item_id FROM item_tags WHERE tag_group = 'Color season')`,
    ),
  ]);
  const counts = { Spring: 0, Summer: 0, Autumn: 0, Winter: 0 };
  for (const { season, count } of rows) {
    if (season in counts) counts[season as ColorSeason] = count;
  }
  return { mine, counts, untagged: untagged?.count ?? 0 };
}

// Wardrobe items tagged with the color season, newest first.
export async function listItemsInColorSeason(db: SQLiteDatabase, season: ColorSeason) {
  const [items, tagged] = await Promise.all([
    listItems(db),
    db.getAllAsync<{ itemId: number }>(
      `SELECT item_id AS itemId FROM item_tags WHERE tag_group = 'Color season' AND value = ?`,
      season,
    ),
  ]);
  const ids = new Set(tagged.map((row) => row.itemId));
  return items.filter((item) => ids.has(item.id));
}

// Works out color seasons from the photos of wardrobe items that don't have one
// yet (such as items added before color seasons existed). Returns how many were tagged.
export async function tagColorSeasonsFromPhotos(db: SQLiteDatabase) {
  const items = await db.getAllAsync<{ id: number; photo: string }>(
    `SELECT id, photo FROM items
     WHERE removed_on IS NULL AND photo IS NOT NULL
       AND id NOT IN (SELECT item_id FROM item_tags WHERE tag_group = 'Color season')`,
  );
  let tagged = 0;
  for (const item of items) {
    const tags = await photoColorTags(photoUri(item.photo), { cutout: isCutout(item.photo) });
    const seasons = tags.filter((tag) => tag.group === 'Color season');
    for (const season of seasons) {
      await db.runAsync(
        'INSERT OR IGNORE INTO item_tags (item_id, tag_group, value) VALUES (?, ?, ?)',
        item.id,
        season.group,
        season.value,
      );
    }
    if (seasons.length > 0) tagged += 1;
  }
  return tagged;
}
