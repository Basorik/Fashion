// Preset description tags, grouped. Users can also add their own tags to any group.
export const TagGroups = {
  Color: [
    'Black',
    'White',
    'Grey',
    'Navy',
    'Blue',
    'Red',
    'Pink',
    'Green',
    'Beige',
    'Brown',
    'Yellow',
    'Purple',
    'Orange',
  ],
  // Color analysis seasons: which people's coloring the item's shades suit
  // (see constants/color-seasons). Separate from Season, which is the weather.
  'Color season': ['Spring', 'Summer', 'Autumn', 'Winter'],
  Style: ['Casual', 'Formal', 'Business', 'Sporty', 'Streetwear', 'Loungewear', 'Party'],
  Season: ['Spring', 'Summer', 'Autumn', 'Winter'],
  Material: ['Cotton', 'Denim', 'Wool', 'Linen', 'Leather', 'Silk', 'Synthetic'],
  Pattern: ['Solid', 'Striped', 'Checked', 'Floral', 'Print'],
  // Letter sizes; numeric and shoe sizes like 32 or 9.5 are added as custom tags.
  Size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
} as const;

export type TagGroup = keyof typeof TagGroups;

export const TagGroupNames = Object.keys(TagGroups) as TagGroup[];

export type Tag = { group: TagGroup; value: string };
