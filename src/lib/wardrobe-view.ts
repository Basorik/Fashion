import type { ItemWithStats } from '@/lib/db';

export const WardrobeSorts = {
  newest: 'Newest',
  'most-worn': 'Most worn',
  'least-worn': 'Least worn',
  'recently-worn': 'Recently worn',
  'longest-unworn': 'Longest unworn',
  'cost-per-wear': 'Highest cost per wear',
  price: 'Highest price',
} as const;

export type WardrobeSort = keyof typeof WardrobeSorts;

export const WardrobeShows = {
  all: 'All',
  ready: 'Ready to wear',
  wash: 'In the wash',
  lent: 'Lent out',
  archived: 'Archived',
} as const;

export type WardrobeShow = keyof typeof WardrobeShows;

// True when every word typed appears in the item's name, brand or tags.
export function matchesSearch(item: ItemWithStats, query: string) {
  const haystack = [item.name, item.brand, item.tagText].join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function matchesShow(item: ItemWithStats, show: WardrobeShow) {
  if (show === 'archived') return item.archivedAt !== null;
  if (item.archivedAt !== null) return false;
  if (show === 'ready') return item.status === null;
  if (show === 'wash') return item.status === 'laundry' || item.status === 'cleaner';
  if (show === 'lent') return item.status === 'lent';
  return true;
}

function costPerWear(item: ItemWithStats) {
  if (item.price === null) return -1;
  // Unworn items cost their whole price per wear so far.
  return item.price / Math.max(item.wearCount, 1);
}

// Dates compare as strings; never-worn items count as the oldest.
const compareLastWorn = (a: ItemWithStats, b: ItemWithStats) =>
  (a.lastWorn ?? '').localeCompare(b.lastWorn ?? '');

const comparators: Record<WardrobeSort, (a: ItemWithStats, b: ItemWithStats) => number> = {
  newest: (a, b) => b.id - a.id,
  'most-worn': (a, b) => b.wearCount - a.wearCount,
  'least-worn': (a, b) => a.wearCount - b.wearCount,
  'recently-worn': (a, b) => compareLastWorn(b, a),
  'longest-unworn': compareLastWorn,
  'cost-per-wear': (a, b) => costPerWear(b) - costPerWear(a),
  price: (a, b) => (b.price ?? -1) - (a.price ?? -1),
};

// Sorts a copy of the items; ties keep newest first.
export function sortItems(items: ItemWithStats[], sort: WardrobeSort) {
  const compare = comparators[sort];
  return [...items].sort((a, b) => compare(a, b) || b.id - a.id);
}
