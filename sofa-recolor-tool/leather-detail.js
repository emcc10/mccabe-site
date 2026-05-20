/**
 * Restore original photo L high-frequency detail onto recolored output (L only).
 * No edge darkening, warmth, or global highlight suppression.
 */
import { rgbToLab } from './render-sofas.js';

const BLUR_RADIUS = 2;
/** ~22% of source L micro-contrast (grain/pores). */
export const PHOTO_HF_GAIN = 0.22;

function boxBlurPass(src, dst, width, height, horizontal) {
  const r = BLUR_RADIUS;
  const win = r * 2 + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      if (horizontal) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = clamp(x + dx, 0, width - 1);
          sum += src[y * width + xx];
          n++;
        }
        dst[y * width + x] = sum / n;
      } else {
        for (let dy = -r; dy <= r; dy++) {
          const yy = clamp(y + dy, 0, height - 1);
          sum += src[yy * width + x];
          n++;
        }
        dst[ y * width + x] = sum / n;
      }
    }
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * High-frequency L residual from original cognac photo (photographic grain structure).
 */
export function preparePhotographicLDetail(sourceImage) {
  const { data, width, height, channels } = sourceImage;
  const n = width * height;
  const L = new Float32Array(n);
  const tmp = new Float32Array(n);
  const blur = new Float32Array(n);
  const hf = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    const p = j * channels;
    L[j] = rgbToLab(data[p], data[p + 1], data[p + 2]).L;
  }

  boxBlurPass(L, tmp, width, height, true);
  boxBlurPass(tmp, blur, width, height, false);

  for (let j = 0; j < n; j++) hf[j] = L[j] - blur[j];

  return { hf, width, height };
}

export function applyPhotographicLDetail(finalL, j, detail, gain = PHOTO_HF_GAIN) {
  return finalL + detail.hf[j] * gain;
}
