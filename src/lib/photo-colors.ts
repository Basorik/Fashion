import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import type { ColorSeason } from '@/constants/color-seasons';
import type { Tag } from '@/constants/tags';
import { decodePng } from '@/lib/png';

const SAMPLE_SIZE = 48;

type Rgb = [number, number, number];

function toHsl([r, g, b]: Rgb) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue =
    max === red
      ? ((green - blue) / delta) % 6
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return { hue, saturation, lightness };
}

// Maps one pixel to the closest preset color name.
export function colorName(rgb: Rgb): string {
  const { hue, saturation, lightness } = toHsl(rgb);
  if (lightness < 0.13) return 'Black';
  if (lightness > 0.9 && saturation < 0.5) return 'White';
  if (hue >= 200 && hue < 250 && lightness < 0.32 && saturation > 0.12) return 'Navy';
  if (saturation < 0.14) return lightness > 0.8 ? 'White' : lightness < 0.2 ? 'Black' : 'Grey';
  if (hue >= 15 && hue < 50) {
    if (lightness < 0.42) return 'Brown';
    if (saturation < 0.55 || lightness > 0.72) return 'Beige';
    return hue < 38 ? 'Orange' : 'Yellow';
  }
  if (hue < 15 || hue >= 345)
    return lightness > 0.72 ? 'Pink' : lightness < 0.3 && saturation < 0.5 ? 'Brown' : 'Red';
  if (hue < 65) return lightness < 0.35 ? 'Green' : 'Yellow';
  if (hue < 170) return 'Green';
  if (hue < 250) return 'Blue';
  if (hue < 290) return 'Purple';
  return 'Pink';
}

// Places one color in a color analysis season by its undertone (warm or cool),
// depth and clarity: Spring is warm and bright, Autumn warm and deep or muted,
// Summer cool and soft, Winter cool and deep or vivid.
export function colorSeason([r, g, b]: Rgb): ColorSeason {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const chroma = max - min;
  const saturation = max === 0 ? 0 : chroma / max;
  const { hue } = toHsl([r, g, b]);
  // A tint of yellow or red in a near-neutral makes it warm (ivory, greige).
  const warmTint = r - b > 8;

  if (max < 0.15) return 'Winter'; // black
  if (chroma < 0.06 || saturation < 0.1) {
    if (max > 0.92) return warmTint ? 'Spring' : 'Winter'; // cream or pure white
    if (max < 0.4) return 'Winter'; // charcoal
    return warmTint ? 'Autumn' : 'Summer'; // taupe or soft grey
  }

  const warm = hue >= 8 && hue < 140;
  if (warm) return max >= 0.85 ? 'Spring' : 'Autumn';
  return saturation >= 0.6 || max < 0.4 ? 'Winter' : 'Summer';
}

function distance(a: Rgb, b: Rgb) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function cutoutPixels(rgba: ArrayLike<number>, width: number, height: number) {
  const colors: Rgb[] = [];
  for (let index = 0; index < width * height * 4; index += 4) {
    if (rgba[index + 3] >= 200) colors.push([rgba[index], rgba[index + 1], rgba[index + 2]]);
  }
  return colors;
}

// Pixels of the item in a photo with a background: the background is estimated
// from the border pixels and excluded, and only the central area is read.
function photoPixels(rgba: ArrayLike<number>, width: number, height: number) {
  const pixel = (x: number, y: number): Rgb => {
    const index = (y * width + x) * 4;
    return [rgba[index], rgba[index + 1], rgba[index + 2]];
  };

  const border: Rgb[] = [];
  for (let x = 0; x < width; x++) border.push(pixel(x, 0), pixel(x, height - 1));
  for (let y = 0; y < height; y++) border.push(pixel(0, y), pixel(width - 1, y));
  const background = border
    .reduce<Rgb>((sum, [r, g, b]) => [sum[0] + r, sum[1] + g, sum[2] + b], [0, 0, 0])
    .map((total) => total / border.length) as Rgb;
  const backgroundIsUniform =
    border.filter((color) => distance(color, background) < 40).length > border.length * 0.6;

  const colors: Rgb[] = [];
  // Only the central area, where the item almost always is.
  for (let y = Math.floor(height * 0.15); y < height * 0.85; y++) {
    for (let x = Math.floor(width * 0.15); x < width * 0.85; x++) {
      const color = pixel(x, y);
      if (backgroundIsUniform && distance(color, background) < 45) continue;
      colors.push(color);
    }
  }
  return colors;
}

// Up to two preset colors the pixels vote for, most common first, each with the
// average of the pixels that voted for it (the actual shade, for its season).
function topColors(colors: Rgb[]) {
  const votes = new Map<string, { count: number; sum: Rgb }>();
  for (const color of colors) {
    const name = colorName(color);
    const entry = votes.get(name) ?? { count: 0, sum: [0, 0, 0] };
    entry.count += 1;
    entry.sum = [entry.sum[0] + color[0], entry.sum[1] + color[1], entry.sum[2] + color[2]];
    votes.set(name, entry);
  }
  const counted = colors.length;
  if (counted === 0) return [];

  const ranked = [...votes.entries()].sort((a, b) => b[1].count - a[1].count);
  return ranked
    .filter(([, { count }], index) => count / counted >= (index === 0 ? 0.3 : 0.25))
    .slice(0, 2)
    .map(([name, { count, sum }]) => ({
      name,
      average: sum.map((total) => total / count) as Rgb,
    }));
}

// Color tags for the main colors, plus the color seasons their shades belong to.
function colorTags(colors: ReturnType<typeof topColors>): Tag[] {
  const seasons = [...new Set(colors.map((color) => colorSeason(color.average)))];
  return [
    ...colors.map((color): Tag => ({ group: 'Color', value: color.name })),
    ...seasons.map((value): Tag => ({ group: 'Color season', value })),
  ];
}

function base64ToBytes(base64: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk =
      (alphabet.indexOf(clean[i]) << 18) |
      (alphabet.indexOf(clean[i + 1]) << 12) |
      ((alphabet.indexOf(clean[i + 2]) & 63) << 6) |
      (alphabet.indexOf(clean[i + 3]) & 63);
    bytes[byteIndex++] = (chunk >> 16) & 255;
    if (i + 2 < clean.length) bytes[byteIndex++] = (chunk >> 8) & 255;
    if (i + 3 < clean.length) bytes[byteIndex++] = chunk & 255;
  }
  return bytes.subarray(0, byteIndex);
}

// Color and color season tags for a photo, computed on the phone: the photo is
// shrunk, decoded in JavaScript, and its main colors matched to the presets. A
// cut-out (a transparent PNG of just the item) is read as a PNG so only the item counts.
export async function photoColorTags(uri: string, { cutout = false } = {}): Promise<Tag[]> {
  try {
    const context = ImageManipulator.manipulate(uri).resize({ width: SAMPLE_SIZE });
    const image = await context.renderAsync();
    if (cutout) {
      const result = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
      const decoded = result.base64 ? decodePng(base64ToBytes(result.base64)) : null;
      if (!decoded) return [];
      return colorTags(topColors(cutoutPixels(decoded.data, decoded.width, decoded.height)));
    }
    const result = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.9 });
    if (!result.base64) return [];
    const { width, height, data } = decode(base64ToBytes(result.base64), {
      useTArray: true,
      formatAsRGBA: true,
    });
    return colorTags(topColors(photoPixels(data, width, height)));
  } catch {
    return [];
  }
}
