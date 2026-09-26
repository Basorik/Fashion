import { unzlibSync } from 'fflate';

// A small PNG decoder for the images the app makes itself: 8-bit RGB or RGBA,
// not interlaced (what expo-image-manipulator writes). Returns RGBA pixels, or
// null for any other kind of PNG.
export function decodePng(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (signature.some((byte, index) => bytes[index] !== byte)) return null;

  let width = 0;
  let height = 0;
  let colorType = 0;
  const compressed: Uint8Array[] = [];
  for (let offset = 8; offset + 8 <= bytes.length; ) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const bitDepth = data[8];
      colorType = data[9];
      const interlaced = data[12] !== 0;
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlaced) return null;
    } else if (type === 'IDAT') {
      compressed.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (width === 0 || height === 0 || compressed.length === 0) return null;

  const joined = new Uint8Array(compressed.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of compressed) {
    joined.set(part, position);
    position += part.length;
  }
  const raw = unzlibSync(joined);

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) return null;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[row - stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? pixels[row - stride + x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const toLeft = Math.abs(estimate - left);
        const toUp = Math.abs(estimate - up);
        const toUpLeft = Math.abs(estimate - upLeft);
        predictor = toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft;
      }
      pixels[row + x] = (raw[source + x] + predictor) & 255;
    }
  }

  if (channels === 4) return { width, height, data: pixels };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    rgba[j] = pixels[i];
    rgba[j + 1] = pixels[i + 1];
    rgba[j + 2] = pixels[i + 2];
    rgba[j + 3] = 255;
  }
  return { width, height, data: rgba };
}
