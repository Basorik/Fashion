import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category } from '@/constants/categories';
import type { Tag } from '@/constants/tags';
import { addItem, type Item, type ItemInput } from '@/lib/db';

export type Wish = {
  id: number;
  name: string;
  category: Category;
  brand: string | null;
  price: number | null;
  url: string | null;
  photo: string | null;
  createdAt: string;
};

export type WishInput = Pick<Wish, 'name' | 'category' | 'brand' | 'price' | 'url' | 'photo'> & {
  tags: Tag[];
};

const wishColumns = 'id, name, category, brand, price, url, photo, created_at AS createdAt';

export function listWishes(db: SQLiteDatabase) {
  return db.getAllAsync<Wish>(`SELECT ${wishColumns} FROM wishes ORDER BY id DESC`);
}

export function getWish(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Wish>(`SELECT ${wishColumns} FROM wishes WHERE id = ?`, id);
}

export function listWishTags(db: SQLiteDatabase, wishId: number) {
  return db.getAllAsync<Tag>(
    'SELECT tag_group AS "group", value FROM wish_tags WHERE wish_id = ? ORDER BY tag_group, value',
    wishId
  );
}

async function replaceWishTags(db: SQLiteDatabase, wishId: number, tags: Tag[]) {
  await db.runAsync('DELETE FROM wish_tags WHERE wish_id = ?', wishId);
  for (const tag of tags) {
    await db.runAsync(
      'INSERT OR IGNORE INTO wish_tags (wish_id, tag_group, value) VALUES (?, ?, ?)',
      wishId,
      tag.group,
      tag.value
    );
  }
}

export async function addWish(db: SQLiteDatabase, wish: WishInput) {
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO wishes (name, category, brand, price, url, photo) VALUES (?, ?, ?, ?, ?, ?)',
      wish.name,
      wish.category,
      wish.brand,
      wish.price,
      wish.url,
      wish.photo
    );
    await replaceWishTags(db, result.lastInsertRowId, wish.tags);
  });
}

export async function updateWish(db: SQLiteDatabase, id: number, wish: WishInput) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE wishes SET name = ?, category = ?, brand = ?, price = ?, url = ?, photo = ? WHERE id = ?',
      wish.name,
      wish.category,
      wish.brand,
      wish.price,
      wish.url,
      wish.photo,
      id
    );
    await replaceWishTags(db, id, wish.tags);
  });
}

export async function deleteWish(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM wishes WHERE id = ?', id);
}

// Moves a wish into the wardrobe, keeping its photo and tags. Returns the new item id.
export async function markWishBought(db: SQLiteDatabase, wish: Wish, tags: Tag[]) {
  const input: ItemInput = {
    name: wish.name,
    category: wish.category,
    brand: wish.brand,
    price: wish.price,
    photo: wish.photo,
    barcode: null,
    tags,
  };
  const itemId = await addItem(db, input);
  await deleteWish(db, wish.id);
  return itemId;
}

// --- Gap finder ---------------------------------------------------------

const NEUTRAL_COLORS = new Set(['Black', 'White', 'Grey', 'Navy', 'Beige', 'Brown']);

// Categories that are worn together with each category.
const PAIRS_WITH: Record<Category, Category[]> = {
  Tops: ['Bottoms', 'Outerwear', 'Shoes', 'Accessories'],
  Bottoms: ['Tops', 'Outerwear', 'Shoes', 'Accessories'],
  Dresses: ['Outerwear', 'Shoes', 'Accessories'],
  Outerwear: ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Accessories'],
  Shoes: ['Tops', 'Bottoms', 'Dresses', 'Outerwear'],
  Accessories: ['Tops', 'Bottoms', 'Dresses', 'Outerwear'],
  Other: ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'],
};

type Tagged = { category: Category; tags: Tag[] };

function values(tags: Tag[], group: Tag['group']) {
  return new Set(tags.filter((tag) => tag.group === group).map((tag) => tag.value));
}

// Untagged on either side counts as compatible: we only rule out clear mismatches.
function overlapsOrUnknown(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return true;
  return [...a].some((value) => b.has(value));
}

function colorsWork(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return true;
  const allNeutral = (set: Set<string>) => [...set].every((color) => NEUTRAL_COLORS.has(color));
  return allNeutral(a) || allNeutral(b) || [...a].some((color) => b.has(color));
}

export function goesWith(candidate: Tagged, owned: Tagged) {
  return (
    PAIRS_WITH[candidate.category].includes(owned.category) &&
    overlapsOrUnknown(values(candidate.tags, 'Style'), values(owned.tags, 'Style')) &&
    overlapsOrUnknown(values(candidate.tags, 'Season'), values(owned.tags, 'Season')) &&
    colorsWork(values(candidate.tags, 'Color'), values(owned.tags, 'Color'))
  );
}

export type OwnedItem = Pick<Item, 'id' | 'name' | 'photo' | 'category'> & { tags: Tag[] };

export async function listOwnedWithTags(db: SQLiteDatabase): Promise<OwnedItem[]> {
  const [items, tags] = await Promise.all([
    db.getAllAsync<Omit<OwnedItem, 'tags'>>('SELECT id, name, photo, category FROM items'),
    db.getAllAsync<Tag & { itemId: number }>(
      'SELECT item_id AS itemId, tag_group AS "group", value FROM item_tags'
    ),
  ]);
  const byItem = new Map<number, Tag[]>();
  for (const { itemId, group, value } of tags) {
    byItem.set(itemId, [...(byItem.get(itemId) ?? []), { group, value }]);
  }
  return items.map((item) => ({ ...item, tags: byItem.get(item.id) ?? [] }));
}

export type WishWithMatches = Wish & { matches: number };

// Wishlist ranked by how many owned items each wish would go with.
export async function listWishesByFit(db: SQLiteDatabase): Promise<WishWithMatches[]> {
  const [wishes, owned, wishTags] = await Promise.all([
    listWishes(db),
    listOwnedWithTags(db),
    db.getAllAsync<Tag & { wishId: number }>(
      'SELECT wish_id AS wishId, tag_group AS "group", value FROM wish_tags'
    ),
  ]);
  return wishes
    .map((wish) => {
      const tags = wishTags.filter((tag) => tag.wishId === wish.id);
      const candidate = { category: wish.category, tags };
      return { ...wish, matches: owned.filter((item) => goesWith(candidate, item)).length };
    })
    .sort((a, b) => b.matches - a.matches);
}
