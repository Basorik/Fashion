import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category } from '@/constants/categories';
import type { Tag } from '@/constants/tags';
import { addItem } from '@/lib/db';
import { importFromLink, shopifyOriginal } from '@/lib/link-import';
import type { OrderItem } from '@/lib/order-email';
import { photoColorTags } from '@/lib/photo-colors';
import { deletePhoto, photoUri, savePhoto } from '@/lib/photos';
import { inferTags, mergeTags } from '@/lib/tag-inference';

export type OrderChoice = OrderItem & { category: Category };

type Options = {
  store: string | null;
  brand: string | null;
  purchasedOn: string | null;
  // Opens each item's product link to fill in its photo, brand and tags.
  lookUpLinks: boolean;
  onProgress?: (done: number, total: number) => void;
};

// Downloads a product photo, returning its stored name, or null if it can't be fetched.
async function tryToSavePhoto(url: string) {
  try {
    return await savePhoto(url);
  } catch {
    return null;
  }
}

// Adds the chosen items from an order email to the wardrobe, one by one.
// Returns how many were added.
export async function addOrderItems(db: SQLiteDatabase, choices: OrderChoice[], options: Options) {
  let added = 0;
  for (const [index, choice] of choices.entries()) {
    options.onProgress?.(index, choices.length);
    const found = options.lookUpLinks && choice.link ? await importFromLink(choice.link) : null;
    const product = found?.ok ? found.product : null;

    let tags: Tag[] = inferTags({
      name: choice.name,
      color: choice.color,
      size: choice.size,
      details: choice.details,
    });
    if (product)
      tags = mergeTags(
        tags,
        inferTags({ ...product, color: choice.color ?? product.color, size: choice.size }),
      );

    // The email's photo shows the color that was bought; the product page's
    // first photo may be another color, so it's only the fallback.
    const photoUrls = [choice.image && shopifyOriginal(choice.image), product?.images[0]].filter(
      (url): url is string => !!url,
    );
    let photo: string | null = null;
    for (const url of photoUrls) {
      photo = await tryToSavePhoto(url);
      if (photo) break;
    }
    if (photo && !tags.some((tag) => tag.group === 'Color')) {
      const fromPhoto = await photoColorTags(photoUri(photo));
      tags = mergeTags(tags, fromPhoto);
    }

    try {
      await addItem(db, {
        name: choice.name,
        category: choice.category,
        brand: options.brand ?? product?.brand ?? null,
        price: choice.price ?? product?.price ?? null,
        photo,
        barcode: null,
        notes: choice.quantity > 1 ? `Bought ${choice.quantity}.` : null,
        store: options.store,
        purchasedOn: options.purchasedOn,
        tags,
      });
    } catch (error) {
      if (photo) deletePhoto(photo);
      throw error;
    }
    added++;
  }
  options.onProgress?.(choices.length, choices.length);
  return added;
}
