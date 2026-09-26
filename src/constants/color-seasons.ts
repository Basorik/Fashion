// The four seasons of color analysis. A person's season comes from their skin,
// hair and eyes; clothes in that season's shades are meant to flatter them.
export const ColorSeasons = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

export type ColorSeason = (typeof ColorSeasons)[number];

export const ColorSeasonInfo: Record<ColorSeason, { description: string; swatches: string[] }> = {
  Spring: {
    description: 'Warm, light and bright: coral, peach, golden yellow, apple green, cream.',
    swatches: ['#FF7F50', '#FFB38A', '#F6C945', '#A8E05F', '#FFF3D6'],
  },
  Summer: {
    description: 'Cool, light and soft: dusty rose, powder blue, lavender, soft grey.',
    swatches: ['#D8A7B1', '#A7C4E0', '#B9A6D6', '#A9ABB3', '#7C93A8'],
  },
  Autumn: {
    description: 'Warm, deep and muted: rust, olive, mustard, camel, chocolate.',
    swatches: ['#B7472A', '#6B6B2A', '#C99A2E', '#B98A55', '#5B3A29'],
  },
  Winter: {
    description: 'Cool, deep and clear: black, pure white, navy, emerald, cobalt, fuchsia.',
    swatches: ['#111111', '#FFFFFF', '#1F2A5A', '#007A5E', '#1F4FD1', '#C8175E'],
  },
};
