/**
 * Measured luminance residuals from original sofa.png (preservation, not synthesis).
 */
import { rgbToLab } from './render-sofas.js';

const HF_BLUR_RADIUS = 1;
const MF_BLUR_LO = 1;
const MF_BLUR_HI = 5;

/** Re-inject photographed leather detail from source catalog image. */
export const PHOTO_HF_GAIN = 0.4;
export const PHOTO_MF_GAIN = 0.15;
/** Soft cap on combined HF+MF injection (LAB L units) — avoids halos / etched seams. */
export const PHOTO_RESIDUAL_CLAMP = 3.5;

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

function gaussianBlur(L, width, height, radius) {
  const tmp = new Float32Array(L.length);
  const out = new Float32Array(L.length);
  boxBlurPass(L, tmp, width, height, true, radius);
  boxBlurPass(tmp, out, width, height, false, radius);
  return out;
}

function highPass(L, width, height, radius) {
  const blur = gaussianBlur(L, width, height, radius);
  const hf = new Float32Array(L.length);
  for (let j = 0; j < L.length; j++) hf[j] = L[j] - blur[j];
  return hf;
}

/**
 * HF: sourceL − blur(sourceL, 1px)
 * MF: blur(sourceL, 1px) − blur(sourceL, 5px)
 */
export function prepareSourceLGrain(sourceImage) {
  const { data, width, height, channels } = sourceImage;
  const n = width * height;
  const L = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    L[j] = rgbToLab(data[p], data[p + 1], data[p + 2]).L;
  }
  const blur1 = gaussianBlur(L, width, height, MF_BLUR_LO);
  const blur5 = gaussianBlur(L, width, height, MF_BLUR_HI);
  const sourceHf = highPass(L, width, height, HF_BLUR_RADIUS);
  const sourceMf = new Float32Array(n);
  for (let j = 0; j < n; j++) sourceMf[j] = blur1[j] - blur5[j];
  return { width, height, sourceHf, sourceMf };
}

function softClampResidual(delta) {
  return clamp(delta, -PHOTO_RESIDUAL_CLAMP, PHOTO_RESIDUAL_CLAMP);
}

export function applySourceLGrain(finalL, j, grain) {
  const delta = softClampResidual(
    grain.sourceHf[j] * PHOTO_HF_GAIN + grain.sourceMf[j] * PHOTO_MF_GAIN,
  );
  return finalL + delta;
}

/** Stress/probe: legacy LF band from source L (debug only). */
export function prepareSourceLLfBand(sourceImage, lfRadius = 6) {
  const { data, width, height, channels } = sourceImage;
  const n = width * height;
  const L = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    L[j] = rgbToLab(data[p], data[p + 1], data[p + 2]).L;
  }
  return highPass(L, width, height, lfRadius);
}
