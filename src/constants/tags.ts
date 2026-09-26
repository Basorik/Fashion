// Preset description tags, grouped. Users can also add their own tags to any group.
export const TagGroups = {
  Color: ['Black', 'White', 'Grey', 'Navy', 'Blue', 'Red', 'Pink', 'Green', 'Beige', 'Brown', 'Yellow', 'Purple', 'Orange'],
  Style: ['Casual', 'Formal', 'Business', 'Sporty', 'Streetwear', 'Loungewear', 'Party'],
  Season: ['Spring', 'Summer', 'Autumn', 'Winter'],
  Material: ['Cotton', 'Denim', 'Wool', 'Linen', 'Leather', 'Silk', 'Synthetic'],
  Pattern: ['Solid', 'Striped', 'Checked', 'Floral', 'Print'],
} as const;

export type TagGroup = keyof typeof TagGroups;

export const TagGroupNames = Object.keys(TagGroups) as TagGroup[];

export type Tag = { group: TagGroup; value: string };
