/**
 * Restore original cognac photo L detail onto recolored output (L only).
 * Uses actual source luminance frequencies — no synthetic grain.
 */
import { rgbToLab } from './render-sofas.js';

const HF_RADIUS = 1;
const MF_RADIUS = 2;
/** Source photo HF/MF gains (tuned for pore + cushion breakup). */
export const PHOTO_HF_GAIN = 0.78;
export const PHOTO_MF_GAIN = 0.3;
export const PHOTO_SEAM_GAIN = 0.14;
const SEAM_GRAD_THRESH = 2.2;

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

function gradientMagnitude(L, width, height) {
  const g = new Float32Array(L.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const xl = clamp(x - 1, 0, width - 1);
      const xr = clamp(x + 1, 0, width - 1);
      const yt = clamp(y - 1, 0, height - 1);
      const yb = clamp(y + 1, 0, height - 1);
      const gx = L[y * width + xr] - L[y * width + xl];
      const gy = L[yb * width + x] - L[yt * width + x];
      g[j] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return g;
}

export function prepareSourceLGrain(sourceImage) {
  const { data, width, height, channels } = sourceImage;
  const n = width * height;
  const L = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    L[j] = rgbToLab(data[p], data[p + 1], data[p + 2]).L;
  }
  const gradMag = gradientMagnitude(L, width, height);
  const seamBoost = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    seamBoost[j] = gradMag[j] > SEAM_GRAD_THRESH ? 1 : 0;
  }
  return {
    width,
    height,
    sourceHf: highPass(L, width, height, HF_RADIUS),
    sourceMf: highPass(L, width, height, MF_RADIUS),
    seamBoost,
  };
}

/**
 * @param {number} u - masked upholstery luminance map position 0–1 (more MF in mids/shadows).
 */
export function applySourceLGrain(finalL, j, grain, u = 0.5) {
  const shadowMidBoost = 1 + 0.45 * (1 - clamp(u, 0, 1));
  const seam = grain.seamBoost[j] * PHOTO_SEAM_GAIN * grain.sourceHf[j];
  return (
    finalL +
    grain.sourceHf[j] * PHOTO_HF_GAIN +
    grain.sourceMf[j] * PHOTO_MF_GAIN * shadowMidBoost +
    seam
  );
}
