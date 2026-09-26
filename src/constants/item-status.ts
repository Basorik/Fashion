// Where an item is when it isn't in the wardrobe ready to wear.
export const ItemStatuses = ['laundry', 'cleaner', 'lent'] as const;

export type ItemStatus = (typeof ItemStatuses)[number];

export const ItemStatusLabels: Record<ItemStatus, string> = {
  laundry: 'In the laundry',
  cleaner: 'At the dry cleaner',
  lent: 'Lent out',
};

// A short label for a status, e.g. on a wardrobe tile. "Lent to Sam" when we know who.
export function statusLabel(status: ItemStatus, lentTo?: string | null) {
  if (status === 'lent' && lentTo) return `Lent to ${lentTo}`;
  return { laundry: 'Laundry', cleaner: 'Dry cleaner', lent: 'Lent out' }[status];
}
