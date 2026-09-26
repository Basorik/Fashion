import type { SQLiteDatabase } from 'expo-sqlite';

import { daysBetween } from '@/lib/dates';
import { listOutfits, today, type Outfit } from '@/lib/db';
import type { Weather } from '@/lib/weather';

export type Suggestion = { outfit: Outfit; reason: string };

type Season = 'Summer' | 'Spring' | 'Autumn' | 'Winter';

function seasonsFor(high: number): Season[] {
  if (high >= 24) return ['Summer'];
  if (high >= 15) return ['Spring', 'Autumn'];
  return ['Winter'];
}

// Ranks saved outfits for today: outfits whose season tags suit the forecast,
// with outerwear when it's cold or wet, and not worn recently.
export async function suggestOutfits(
  db: SQLiteDatabase,
  weather: Weather | null,
  limit = 3,
): Promise<Suggestion[]> {
  const [outfits, rows] = await Promise.all([
    listOutfits(db),
    db.getAllAsync<{ outfitId: number; category: string; seasons: string | null }>(
      `SELECT outfit_items.outfit_id AS outfitId, items.category,
         (SELECT group_concat(value) FROM item_tags
          WHERE item_id = items.id AND tag_group = 'Season') AS seasons
       FROM outfit_items JOIN items ON items.id = outfit_items.item_id`,
    ),
  ]);

  const byOutfit = new Map<number, { categories: Set<string>; seasons: Set<string> }>();
  for (const row of rows) {
    const entry = byOutfit.get(row.outfitId) ?? { categories: new Set(), seasons: new Set() };
    entry.categories.add(row.category);
    for (const season of row.seasons?.split(',') ?? []) entry.seasons.add(season);
    byOutfit.set(row.outfitId, entry);
  }

  const now = today();
  const targets = weather ? seasonsFor(weather.high) : [];
  const cold = weather ? weather.high < 12 : false;
  const hot = weather ? weather.high >= 24 : false;
  const wet = weather ? weather.rainChance >= 50 : false;

  const scored = outfits
    .filter((outfit) => byOutfit.has(outfit.id))
    .map((outfit) => {
      const { categories, seasons } = byOutfit.get(outfit.id)!;
      const reasons: string[] = [];
      let score = 0;

      if (weather && seasons.size > 0) {
        if (targets.some((season) => seasons.has(season))) {
          score += 3;
          reasons.push(`good for ${targets.join('/').toLowerCase()} weather`);
        } else {
          score -= 3;
        }
      }
      const hasOuterwear = categories.has('Outerwear');
      if ((cold || wet) && hasOuterwear) {
        score += 2;
        reasons.push(wet ? 'has a layer for the rain' : 'has a warm layer');
      }
      if (hot && hasOuterwear) score -= 2;

      const daysSince = outfit.lastWorn ? daysBetween(outfit.lastWorn, now) : 30;
      score += Math.min(daysSince, 30) / 10;
      reasons.push(outfit.lastWorn ? `last worn ${daysSince} days ago` : 'not worn yet');
      if (daysSince === 0) score -= 10;

      const reason = reasons.join(', ');
      return { outfit, score, reason: reason.charAt(0).toUpperCase() + reason.slice(1) };
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ outfit, reason }) => ({ outfit, reason }));
}
