/**
 * Restore original cognac photo L grain onto recolored output (L only).
 */
import { rgbToLab } from './render-sofas.js';

const HF_RADIUS = 1;
const MF_RADIUS = 3;
export const PHOTO_HF_GAIN = 0.34;
export const PHOTO_MF_GAIN = 0.11;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function boxBlurPass(src, dst, width, height, horizontal, radius) {
  const r = radius;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      if (horizontal) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = clamp(x + dx, 0, width - 1);
          sum += src[y * width + xx];
        }
        dst[y * width + x] = sum / (r * 2 + 1);
      } else {
        for (let dy = -r; dy <= r; dy++) {
          const yy = clamp(y + dy, 0, height - 1);
          sum += src[yy * width + x];
        }
        dst[y * width + x] = sum / (r * 2 + 1);
      }
    }
  }
}

function highPass(L, width, height, radius) {
  const tmp = new Float32Array(L.length);
  const blur = new Float32Array(L.length);
  const hf = new Float32Array(L.length);
  boxBlurPass(L, tmp, width, height, true, radius);
  boxBlurPass(tmp, blur, width, height, false, radius);
  for (let j = 0; j < L.length; j++) hf[j] = L[j] - blur[j];
  return hf;
}

export function prepareSourceLGrain(sourceImage) {
  const { data, width, height, channels } = sourceImage;
  const n = width * height;
  const L = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    L[j] = rgbToLab(data[p], data[p + 1], data[p + 2]).L;
  }
  return {
    width,
    height,
    sourceHf: highPass(L, width, height, HF_RADIUS),
    sourceMf: highPass(L, width, height, MF_RADIUS),
  };
}

export function applySourceLGrain(finalL, j, grain) {
  return finalL + grain.sourceHf[j] * PHOTO_HF_GAIN + grain.sourceMf[j] * PHOTO_MF_GAIN;
}
