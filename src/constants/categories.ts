export const Categories = [
  'Tops',
  'Bottoms',
  'Dresses',
  'Outerwear',
  'Shoes',
  'Accessories',
  'Other',
] as const;

export type Category = (typeof Categories)[number];
