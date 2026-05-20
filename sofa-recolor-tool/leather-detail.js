/**
 * Photographic L structure from original + neutral master (no chroma/warmth changes).
 */
import { rgbToLab } from './render-sofas.js';

const HF_RADIUS = 1;
const MF_RADIUS = 4;
export const PHOTO_HF_GAIN = 0.42;
export const PHOTO_MF_GAIN = 0.14;
export const NEUTRAL_HF_GAIN = 0.28;

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

function extractLabL(image) {
  const { data, width, height, channels } = image;
  const n = width * height;
  const L = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    L[j] = rgbToLab(data[p], data[p + 1], data[p + 2]).L;
  }
  return { L, width, height };
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

export function preparePhotographicStructure(sourceImage, neutralMaster) {
  const src = extractLabL(sourceImage);
  const neu = extractLabL(neutralMaster);
  return {
    width: src.width,
    height: src.height,
    sourceHf: highPass(src.L, src.width, src.height, HF_RADIUS),
    sourceMf: highPass(src.L, src.width, src.height, MF_RADIUS),
    neutralHf: highPass(neu.L, neu.width, neu.height, HF_RADIUS),
  };
}

export function applyPhotographicLDetail(finalL, j, detail) {
  return (
    finalL +
    detail.sourceHf[j] * PHOTO_HF_GAIN +
    detail.sourceMf[j] * PHOTO_MF_GAIN +
    detail.neutralHf[j] * NEUTRAL_HF_GAIN
  );
}
