import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import type { Mask } from './masks.js';
import type { RgbaImage } from './segment.js';

async function writeRgb(path: string, width: number, height: number, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(path);
}

export async function writeMaskPreview(path: string, mask: Mask) {
  const buf = Buffer.alloc(mask.width * mask.height * 3);
  for (let i = 0; i < mask.data.length; i++) {
    const v = mask.data[i] >= 128 ? 255 : 0;
    const o = i * 3;
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
  }
  await writeRgb(path, mask.width, mask.height, buf);
}

export async function writeAlphaPreview(path: string, image: RgbaImage, alpha: Mask) {
  const { width, height, channels } = image;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    if (alpha.data[j] < 128) {
      buf[o] = 32;
      buf[o + 1] = 32;
      buf[o + 2] = 40;
    } else {
      buf[o] = image.data[p];
      buf[o + 1] = image.data[p + 1];
      buf[o + 2] = image.data[p + 2];
    }
  }
  await writeRgb(path, width, height, buf);
}

function blendOverlay(
  image: RgbaImage,
  upholstery: Mask,
  legs: Mask,
): Buffer {
  const { width, height, channels } = image;
  const buf = Buffer.alloc(width * height * 3);

  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = image.data[p];
    let g = image.data[p + 1];
    let b = image.data[p + 2];

    if (upholstery.data[j] >= 128) {
      r = Math.round(r * 0.55 + 255 * 0.45);
      g = Math.round(g * 0.55 + 40 * 0.45);
      b = Math.round(b * 0.55 + 40 * 0.45);
    }
    if (legs.data[j] >= 128) {
      r = Math.round(r * 0.55 + 40 * 0.45);
      g = Math.round(g * 0.55 + 80 * 0.45);
      b = Math.round(b * 0.55 + 255 * 0.45);
    }

    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

export async function writeCombinedOverlay(
  path: string,
  image: RgbaImage,
  upholstery: Mask,
  legs: Mask,
) {
  const buf = blendOverlay(image, upholstery, legs);
  await writeRgb(path, image.width, image.height, buf);
}
