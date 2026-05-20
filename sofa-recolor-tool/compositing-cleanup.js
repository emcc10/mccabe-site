/**
 * Floor/edge compositing cleanup — no geometry repaint.
 */
import { MASK_APPLY_THRESH, isNearWhite } from './render-sofas.js';

const FLOOR_SHADOW_MAX = 28;
const FLOOR_FALLOFF_ROWS = 72;
const FRINGE_PX = 3;
const STREAK_ROW_DARK = 210;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function maskBoundingBox(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] < MASK_APPLY_THRESH) continue;
      any = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return any ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
}

function rowDarkFraction(data, y, width, channels, x0, x1) {
  let dark = 0;
  let n = 0;
  for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * channels;
    const lum = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
    if (lum < STREAK_ROW_DARK) dark++;
    n++;
  }
  return n ? dark / n : 0;
}

/** Soft contact shadow; removes stray horizontal floor lines from source. */
function paintFloorShadow(out, mask, width, height, channels, box) {
  const x0 = Math.max(0, box.minX - 8);
  const x1 = Math.min(width - 1, box.maxX + 8);
  const y0 = box.maxY + 1;

  for (let y = y0; y < height; y++) {
    const t = clamp((y - y0) / FLOOR_FALLOFF_ROWS, 0, 1);
    const shade = Math.round(255 - t * t * FLOOR_SHADOW_MAX);
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      out[p] = shade;
      out[p + 1] = shade;
      out[p + 2] = shade;
      if (channels === 4) out[p + 3] = 255;
    }
  }
}

/** Remove white fringe / stray pixels just outside upholstery mask. */
function cleanMaskFringe(out, source, mask, width, height, channels) {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;

      let nearMask = false;
      for (let dy = -FRINGE_PX; dy <= FRINGE_PX && !nearMask; dy++) {
        for (let dx = -FRINGE_PX; dx <= FRINGE_PX; dx++) {
          if (mask[(y + dy) * width + (x + dx)] >= MASK_APPLY_THRESH) {
            nearMask = true;
            break;
          }
        }
      }
      if (!nearMask) continue;

      const p = j * channels;
      const lum = 0.2126 * out[p] + 0.7152 * out[p + 1] + 0.0722 * out[p + 2];
      const srcP = j * channels;
      const srcNearWhite = isNearWhite(source[srcP], source[srcP + 1], source[srcP + 2]);

      if (lum > 248 && !srcNearWhite) {
        out[p] = 255;
        out[p + 1] = 255;
        out[p + 2] = 255;
      } else if (lum < 235 && srcNearWhite) {
        out[p] = 255;
        out[p + 1] = 255;
        out[p + 2] = 255;
      }
    }
  }
}

/** Suppress thin horizontal streak rows in floor band. */
function suppressFloorStreaks(out, mask, width, height, channels, box) {
  const x0 = box.minX;
  const x1 = box.maxX;
  for (let y = box.maxY + 2; y < Math.min(height, box.maxY + FLOOR_FALLOFF_ROWS); y++) {
    const frac = rowDarkFraction(out, y, width, channels, x0, x1);
    if (frac < 0.08 || frac > 0.55) continue;
    const yPrev = Math.max(box.maxY, y - 2);
    const yNext = Math.min(height - 1, y + 2);
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let n = 0;
      for (const yy of [yPrev, yNext]) {
        const p = (yy * width + x) * channels;
        sr += out[p];
        sg += out[p + 1];
        sb += out[p + 2];
        n++;
      }
      const p = j * channels;
      out[p] = Math.round(sr / n);
      out[p + 1] = Math.round(sg / n);
      out[p + 2] = Math.round(sb / n);
    }
  }
}

export function cleanSofaCompositing(outBuffer, sourceImage, mask) {
  const { width, height, channels } = sourceImage;
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);

  paintFloorShadow(out, mask, width, height, channels, box);
  suppressFloorStreaks(out, mask, width, height, channels, box);
  cleanMaskFringe(out, sourceImage.data, mask, width, height, channels);

  return out;
}
