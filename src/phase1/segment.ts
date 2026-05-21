import sharp from 'sharp';
import type { Mask } from './masks.js';
import { bbox, dilate, dropSmall, erode, intersect, subtract } from './masks.js';

const LEG_EXPAND_PX = 4;
const UPHOLSTERY_CONTRACT_PX = 1;
const MIN_REGION = 350;

export interface RgbaImage {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export async function loadRgba(path: string): Promise<RgbaImage> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

export async function loadMaskPng(path: string, w: number, h: number): Promise<Mask> {
  const { data, info } = await sharp(path)
    .resize(w, h, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i] >= 128 ? 255 : 0;
  return { data: out, width: info.width, height: info.height };
}

export function alphaFromImage(image: RgbaImage): Mask {
  const { width, height, channels, data } = image;
  const alpha = new Uint8Array(width * height);
  if (channels === 4) {
    for (let j = 0; j < width * height; j++) {
      alpha[j] = data[j * 4 + 3] >= 128 ? 255 : 0;
    }
  } else {
    for (let j = 0; j < width * height; j++) {
      const p = j * channels;
      alpha[j] = lum(data[p], data[p + 1], data[p + 2]) < 248 ? 255 : 0;
    }
  }
  return { data: alpha, width, height };
}

export function detectLegs(image: RgbaImage, alpha: Mask): Mask {
  const { width, height, channels, data } = image;
  const bb = bbox(alpha);
  if (!bb) return { data: new Uint8Array(width * height), width, height };

  const legs = new Uint8Array(width * height);
  const yLegStart = bb.minY + Math.floor((bb.maxY - bb.minY) * 0.62);
  const xRightLeg = bb.minX + Math.floor((bb.maxX - bb.minX) * 0.72);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (alpha.data[j] < 128) continue;
      const p = j * channels;
      const L = lum(data[p], data[p + 1], data[p + 2]);
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const inBottom = y >= yLegStart;
      const darkFoot = L < 95 && chroma < 55;
      const rightLegZone = x >= xRightLeg && y >= bb.minY + Math.floor((bb.maxY - bb.minY) * 0.78);
      if (inBottom && (darkFoot || rightLegZone)) legs[j] = 255;
    }
  }

  return dropSmall({ data: legs, width, height }, MIN_REGION);
}

export function buildPhase1Masks(
  image: RgbaImage,
  handUpholstery: Mask,
  handLegs?: Mask,
): { alpha: Mask; upholstery: Mask; legs: Mask } {
  const alpha = alphaFromImage(image);
  let legs = handLegs ?? detectLegs(image, alpha);
  if (!handLegs) {
    legs = dilate(legs, LEG_EXPAND_PX);
  }

  let upholstery = intersect(handUpholstery, alpha);
  upholstery = subtract(upholstery, legs);
  if (UPHOLSTERY_CONTRACT_PX > 0) {
    upholstery = erode(upholstery, UPHOLSTERY_CONTRACT_PX);
  }
  upholstery = subtract(upholstery, legs);
  upholstery = dropSmall(upholstery, MIN_REGION);

  return { alpha, upholstery, legs };
}
