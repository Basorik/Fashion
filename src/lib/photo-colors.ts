import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import type { Tag } from '@/constants/tags';

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

function distance(a: Rgb, b: Rgb) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// Finds the item's main colors in an RGBA pixel grid. The background is
// estimated from the border pixels and excluded, then the remaining pixels
// vote for preset colors. Returns up to two colors, most common first.
export function dominantColors(rgba: ArrayLike<number>, width: number, height: number): string[] {
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

  const votes = new Map<string, number>();
  let counted = 0;
  // Only the central area, where the item almost always is.
  for (let y = Math.floor(height * 0.15); y < height * 0.85; y++) {
    for (let x = Math.floor(width * 0.15); x < width * 0.85; x++) {
      const color = pixel(x, y);
      if (backgroundIsUniform && distance(color, background) < 45) continue;
      const name = colorName(color);
      votes.set(name, (votes.get(name) ?? 0) + 1);
      counted++;
    }
  }
  if (counted === 0) return [];

  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  return ranked
    .filter(([, count], index) => count / counted >= (index === 0 ? 0.3 : 0.25))
    .slice(0, 2)
    .map(([name]) => name);
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

// Color tags for a photo, computed on the phone: the photo is shrunk to a
// small JPEG, decoded in JavaScript, and its main colors matched to the presets.
export async function photoColorTags(uri: string): Promise<Tag[]> {
  try {
    const context = ImageManipulator.manipulate(uri).resize({ width: SAMPLE_SIZE });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.9 });
    if (!result.base64) return [];
    const { width, height, data } = decode(base64ToBytes(result.base64), {
      useTArray: true,
      formatAsRGBA: true,
    });
    return dominantColors(data, width, height).map((value) => ({ group: 'Color', value }));
  } catch {
    return [];
  }
}
