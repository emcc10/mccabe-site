/**
 * Outside-mask only: restore source AA fringe (ivory interior ↔ white).
 * Does not modify upholstery pixels.
 */
import { MASK_APPLY_THRESH } from './render-sofas.js';

const FRINGE_PX = 2;
const DARK_LUM_MAX = 108;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function pixelLum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isDark(r, g, b) {
  return pixelLum(r, g, b) <= DARK_LUM_MAX;
}

function touchesMask(mask, width, height, x, y) {
  for (let dy = -FRINGE_PX; dy <= FRINGE_PX; dy++) {
    for (let dx = -FRINGE_PX; dx <= FRINGE_PX; dx++) {
      if (dx === 0 && dy === 0) continue;
      const yy = y + dy;
      const xx = x + dx;
      if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
      if (mask[yy * width + xx] >= MASK_APPLY_THRESH) return true;
    }
  }
  return false;
}

function nearestInteriorRgb(out, mask, width, height, channels, x, y) {
  for (let r = 1; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const yy = y + dy;
        const xx = x + dx;
        if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
        const j = yy * width + xx;
        if (mask[j] < MASK_APPLY_THRESH) continue;
        const p = j * channels;
        return [out[p], out[p + 1], out[p + 2]];
      }
    }
  }
  return [187, 177, 162];
}

export function restorePhotographicEdges(outBuffer, sourceImage, mask) {
  const { data: src, width, height, channels } = sourceImage;
  const out = outBuffer;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      if (!touchesMask(mask, width, height, x, y)) continue;

      const p = j * channels;
      const sr = src[p];
      const sg = src[p + 1];
      const sb = src[p + 2];
      if (isDark(sr, sg, sb)) continue;

      const srcLum = pixelLum(sr, sg, sb);
      const [ir, ig, ib] = nearestInteriorRgb(out, mask, width, height, channels, x, y);
      const t = clamp((248 - srcLum) / 110, 0, 1);

      out[p] = Math.round(255 * (1 - t) + ir * t);
      out[p + 1] = Math.round(255 * (1 - t) + ig * t);
      out[p + 2] = Math.round(255 * (1 - t) + ib * t);
      if (channels === 4) out[p + 3] = 255;
    }
  }

  return out;
}
