import type { Category } from '@/constants/categories';
import type { Tag, TagGroup } from '@/constants/tags';

// Text gathered from a product page or barcode lookup. Fields are kept apart
// because they're trusted differently: an explicit color field beats a color
// word in a description that may list every colorway.
export type ProductText = {
  name?: string | null;
  color?: string | null;
  material?: string | null;
  category?: string | null;
  description?: string | null;
  keywords?: string[];
};

type Dictionary = Record<string, string[]>;

// Preset tag value -> words that mean it. Matched as whole words, case-insensitively.
const COLOR_WORDS: Dictionary = {
  Black: ['black', 'jet', 'onyx', 'noir'],
  White: ['white', 'ivory', 'off-white', 'off white', 'optic white', 'snow'],
  Grey: ['grey', 'gray', 'charcoal', 'heather', 'slate', 'ash', 'graphite', 'silver'],
  Navy: ['navy', 'midnight', 'dark blue'],
  Blue: ['blue', 'indigo', 'denim', 'cobalt', 'sky', 'light blue', 'azure', 'teal'],
  Red: ['red', 'burgundy', 'maroon', 'wine', 'crimson', 'scarlet', 'oxblood', 'cherry'],
  Pink: ['pink', 'rose', 'blush', 'fuchsia', 'magenta', 'salmon'],
  Green: ['green', 'olive', 'khaki green', 'sage', 'forest', 'emerald', 'mint', 'army'],
  Beige: [
    'beige',
    'cream',
    'ecru',
    'sand',
    'camel',
    'tan',
    'khaki',
    'stone',
    'oatmeal',
    'nude',
    'taupe',
  ],
  Brown: ['brown', 'chocolate', 'mocha', 'coffee', 'cognac', 'chestnut', 'espresso'],
  Yellow: ['yellow', 'mustard', 'lemon', 'gold'],
  Purple: ['purple', 'lilac', 'lavender', 'violet', 'plum', 'mauve'],
  Orange: ['orange', 'rust', 'terracotta', 'coral', 'burnt orange', 'apricot'],
};

const MATERIAL_WORDS: Dictionary = {
  Cotton: ['cotton', 'organic cotton', 'pima', 'poplin', 'oxford cloth', 'jersey', 'chambray'],
  Denim: ['denim', 'jean', 'jeans'],
  Wool: ['wool', 'merino', 'cashmere', 'alpaca', 'mohair', 'lambswool', 'tweed'],
  Linen: ['linen', 'flax'],
  Leather: ['leather', 'suede', 'nubuck'],
  Silk: ['silk', 'satin'],
  Synthetic: [
    'polyester',
    'nylon',
    'elastane',
    'spandex',
    'acrylic',
    'viscose',
    'rayon',
    'lyocell',
    'modal',
    'recycled polyester',
    'fleece',
  ],
};

const PATTERN_WORDS: Dictionary = {
  Striped: ['stripe', 'striped', 'stripes', 'pinstripe', 'breton'],
  Checked: ['check', 'checked', 'checks', 'plaid', 'gingham', 'tartan', 'houndstooth'],
  Floral: ['floral', 'flower', 'flowers', 'botanical'],
  Print: [
    'print',
    'printed',
    'graphic',
    'pattern',
    'patterned',
    'logo',
    'animal print',
    'leopard',
    'camo',
    'paisley',
    'polka dot',
  ],
  Solid: ['solid', 'plain', 'block color', 'block colour'],
};

const STYLE_WORDS: Dictionary = {
  Formal: ['formal', 'tuxedo', 'suit', 'evening wear', 'black tie', 'dress shoe', 'oxford shoe'],
  Business: [
    'business',
    'office',
    'workwear',
    'tailored',
    'blazer',
    'dress shirt',
    'trousers',
    'loafer',
    'loafers',
  ],
  Sporty: [
    'sport',
    'sports',
    'running',
    'athletic',
    'gym',
    'training',
    'workout',
    'performance',
    'activewear',
    'yoga',
    'tennis',
    'golf',
  ],
  Streetwear: ['streetwear', 'oversized', 'graphic tee', 'skate', 'cargo'],
  Loungewear: [
    'lounge',
    'loungewear',
    'pajama',
    'pyjama',
    'sleepwear',
    'sweatpants',
    'joggers',
    'slippers',
  ],
  Party: ['party', 'sequin', 'sequined', 'cocktail', 'glitter', 'going out'],
  Casual: [
    'casual',
    'everyday',
    't-shirt',
    'tee',
    'jeans',
    'sneaker',
    'sneakers',
    'hoodie',
    'sweatshirt',
  ],
};

const SEASON_WORDS: Dictionary = {
  Summer: [
    'summer',
    'linen',
    'shorts',
    'sandal',
    'sandals',
    'swim',
    'swimwear',
    'tank',
    'short sleeve',
    'short-sleeve',
    'lightweight',
    'breathable',
  ],
  Winter: [
    'winter',
    'wool',
    'cashmere',
    'down jacket',
    'down-filled',
    'puffer',
    'parka',
    'fleece',
    'thermal',
    'insulated',
    'shearling',
    'beanie',
    'scarf',
    'snow boot',
  ],
  Spring: ['spring', 'trench', 'light jacket', 'cardigan', 'windbreaker', 'transitional'],
  Autumn: ['autumn', 'fall', 'trench', 'cardigan', 'flannel', 'corduroy', 'transitional'],
};

// The longest matching phrase wins, so "dress shirt" is a top and "shirt dress" a dress.
const CATEGORY_WORDS: [Category, string[]][] = [
  [
    'Shoes',
    [
      'shoe',
      'shoes',
      'sneaker',
      'sneakers',
      'trainer',
      'trainers',
      'runner',
      'runners',
      'boot',
      'boots',
      'sandal',
      'sandals',
      'loafer',
      'loafers',
      'heel',
      'heels',
      'slipper',
      'slippers',
      'mule',
      'mules',
      'clog',
      'espadrille',
      'footwear',
    ],
  ],
  [
    'Tops',
    [
      'dress shirt',
      'shirt',
      'shirts',
      't-shirt',
      'tee',
      'top',
      'tops',
      'blouse',
      'sweater',
      'jumper',
      'hoodie',
      'sweatshirt',
      'polo',
      'tank',
      'cardigan',
      'knit',
      'pullover',
      'camisole',
      'bodysuit',
      'turtleneck',
    ],
  ],
  [
    'Dresses',
    [
      'shirt dress',
      'shirtdress',
      'sweater dress',
      't-shirt dress',
      'dress',
      'dresses',
      'jumpsuit',
      'romper',
      'playsuit',
      'gown',
    ],
  ],
  [
    'Outerwear',
    [
      'jacket',
      'coat',
      'parka',
      'blazer',
      'puffer',
      'trench',
      'gilet',
      'anorak',
      'windbreaker',
      'overcoat',
      'raincoat',
      'bomber',
      'outerwear',
    ],
  ],
  [
    'Bottoms',
    [
      'jeans',
      'pants',
      'trousers',
      'shorts',
      'skirt',
      'chinos',
      'chino',
      'joggers',
      'leggings',
      'sweatpants',
      'culottes',
    ],
  ],
  [
    'Accessories',
    [
      'bag',
      'handbag',
      'tote',
      'backpack',
      'belt',
      'hat',
      'cap',
      'beanie',
      'scarf',
      'sunglasses',
      'watch',
      'wallet',
      'necklace',
      'bracelet',
      'earrings',
      'ring',
      'jewelry',
      'jewellery',
      'gloves',
      'socks',
      'tie',
    ],
  ],
];

const CATEGORY_PHRASES = CATEGORY_WORDS.flatMap(([category, words]) =>
  words.map((word) => [category, word] as const),
).sort((a, b) => b[1].length - a[1].length);

function escape(word: string) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
}

function containsWord(text: string, word: string) {
  return new RegExp(`(^|[^a-z])${escape(word)}($|[^a-z])`, 'i').test(text);
}

function matches(text: string, dictionary: Dictionary) {
  return Object.entries(dictionary)
    .filter(([, words]) => words.some((word) => containsWord(text, word)))
    .map(([value]) => value);
}

function stripHtml(text: string) {
  return text.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
}

// With a composition like "98% cotton, 2% elastane", only fibers making up at
// least a fifth of the fabric count; trace stretch fibers aren't the material.
function inferMaterials(product: ProductText, description: string) {
  const text = [product.material, product.name, description].filter(Boolean).join(' ');
  const found = matches(text, MATERIAL_WORDS);
  const shares = [...text.matchAll(/(\d{1,3})\s*%\s*([a-z][a-z\s-]*)/gi)];
  if (shares.length === 0) return found;
  return found.filter((material) => {
    const share = shares.find(([, , fiber]) =>
      MATERIAL_WORDS[material].some((word) => containsWord(fiber, word)),
    );
    return !share || Number(share[1]) >= 20;
  });
}

export function inferCategory(product: ProductText): Category | null {
  // The shop's own category or product type is the strongest signal, then the name.
  for (const text of [product.category, product.keywords?.join(' '), product.name]) {
    if (!text) continue;
    const match = CATEGORY_PHRASES.find(([, word]) => containsWord(text, word));
    if (match) return match[0];
  }
  return null;
}

// Suggests preset tags from product text. Colors come from the explicit color
// field when there is one, otherwise the product name; never the description.
export function inferTags(product: ProductText): Tag[] {
  const description = stripHtml(product.description ?? '');
  const keywords = product.keywords?.join(' ') ?? '';
  const nameAndKeywords = [product.name, product.category, keywords].filter(Boolean).join(' ');
  const everything = [nameAndKeywords, product.material, description].filter(Boolean).join(' ');

  const byGroup: [TagGroup, string[]][] = [
    ['Color', matches(product.color || product.name || '', COLOR_WORDS)],
    ['Material', inferMaterials(product, description)],
    ['Pattern', matches(nameAndKeywords, PATTERN_WORDS)],
    ['Style', matches(everything, STYLE_WORDS)],
    ['Season', matches(everything, SEASON_WORDS)],
  ];

  const tags: Tag[] = [];
  for (const [group, values] of byGroup) {
    // A long list of matches usually means a "comes in every color" blurb; keep the first few.
    for (const value of values.slice(0, group === 'Season' ? 2 : 3)) tags.push({ group, value });
  }
  // Denim is both a material and a blue color word; don't tag jeans as blue from "denim" alone.
  if (!product.color && tags.some((tag) => tag.value === 'Denim')) {
    return tags.filter(
      (tag) =>
        !(
          tag.group === 'Color' &&
          tag.value === 'Blue' &&
          !containsWord(product.name ?? '', 'blue')
        ),
    );
  }
  return tags;
}

// Adds suggested tags the item doesn't already have.
export function mergeTags(current: Tag[], suggested: Tag[]) {
  const key = (tag: Tag) => `${tag.group}:${tag.value.toLowerCase()}`;
  const existing = new Set(current.map(key));
  return [...current, ...suggested.filter((tag) => !existing.has(key(tag)))];
}
