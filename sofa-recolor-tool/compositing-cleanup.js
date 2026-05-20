/**
 * Studio background cleanup — preserve feet/product pixels from source photo.
 */
import { MASK_APPLY_THRESH, isNearWhite } from './render-sofas.js';

const BG = 255;
const FLOOR_SHADOW_MAX = 42;
const FLOOR_FALLOFF_ROWS = 92;
const FRINGE_PX = 2;
const WHITE_LINE_LUM = 246;
const PRODUCT_LUM_MAX = 108;

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

function pixelLum(data, p) {
  return 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
}

function floorShade(y, y0) {
  const t = clamp((y - y0) / FLOOR_FALLOFF_ROWS, 0, 1);
  return Math.round(BG - t * FLOOR_SHADOW_MAX);
}

function setRgb(out, p, r, g, b, channels) {
  out[p] = r;
  out[p + 1] = g;
  out[p + 2] = b;
  if (channels === 4) out[p + 3] = 255;
}

/** Feet, legs, dark base — never composite over these. */
function isPreservedProductPixel(src, p) {
  const r = src[p];
  const g = src[p + 1];
  const b = src[p + 2];
  const lum = pixelLum(src, p);
  if (lum <= PRODUCT_LUM_MAX) return true;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return lum < 150 && spread < 40;
}

function isStudioBackgroundPixel(src, p) {
  const r = src[p];
  const g = src[p + 1];
  const b = src[p + 2];
  if (isNearWhite(r, g, b)) return true;
  const lum = pixelLum(src, p);
  return lum >= 210 && lum <= 254;
}

function copySourcePixel(out, src, p, channels) {
  out[p] = src[p];
  out[p + 1] = src[p + 1];
  out[p + 2] = src[p + 2];
  if (channels === 4) out[p + 3] = src[p + 3] ?? 255;
}

/** Restore all non-upholstery product geometry from original photo. */
function preserveSourceProduct(out, src, mask, width, height, channels) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (isPreservedProductPixel(src, p)) {
      copySourcePixel(out, src, p, channels);
    }
  }
}

function forceWhiteBackground(out, src, mask, width, height, channels, yBelow) {
  for (let y = 0; y < yBelow; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isPreservedProductPixel(src, p)) {
        copySourcePixel(out, src, p, channels);
        continue;
      }
      if (isStudioBackgroundPixel(src, p)) {
        setRgb(out, p, BG, BG, BG, channels);
      }
    }
  }
}

/** Natural studio grounding shadow — background pixels only, below sofa base. */
function paintStudioFloorShadow(out, src, mask, width, height, channels, box) {
  const y0 = box.maxY + 1;
  const xPad = 16;
  const x0 = Math.max(0, box.minX - xPad);
  const x1 = Math.min(width - 1, box.maxX + xPad);

  for (let y = y0; y < height; y++) {
    const shade = floorShade(y, y0);
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isPreservedProductPixel(src, p)) {
        copySourcePixel(out, src, p, channels);
        continue;
      }
      if (!isStudioBackgroundPixel(src, p) && x >= x0 && x <= x1) {
        continue;
      }
      if (!isStudioBackgroundPixel(src, p) && x < x0) {
        setRgb(out, p, BG, BG, BG, channels);
        continue;
      }
      if (!isStudioBackgroundPixel(src, p) && x > x1) {
        setRgb(out, p, BG, BG, BG, channels);
        continue;
      }
      setRgb(out, p, shade, shade, shade, channels);
    }
  }
}

/** Remove horizontal white lines in shadow band only (skip rows with feet). */
function eraseFloorWhiteLines(out, src, mask, width, height, channels, box) {
  const y0 = box.maxY + 1;
  const yEnd = Math.min(height - 1, box.maxY + FLOOR_FALLOFF_ROWS);
  const x0 = Math.max(0, box.minX - 8);
  const x1 = Math.min(width - 1, box.maxX + 8);

  for (let y = y0; y < yEnd; y++) {
    let feet = 0;
    let white = 0;
    let n = 0;
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      n++;
      const p = j * channels;
      if (isPreservedProductPixel(src, p)) feet++;
      else if (pixelLum(out, p) >= WHITE_LINE_LUM) white++;
    }
    if (feet > 1) continue;

    const shade = floorShade(y, y0);
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isPreservedProductPixel(src, p)) continue;
      if (pixelLum(out, p) >= WHITE_LINE_LUM) {
        setRgb(out, p, shade, shade, shade, channels);
      }
    }
  }
}

/** Snap only obvious white halos beside upholstery — not feet or dark base. */
function snapWhiteHalos(out, src, mask, width, height, channels, box) {
  const yMax = Math.min(height - 1, box.maxY + 4);
  for (let y = Math.max(0, box.minY); y <= yMax; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isPreservedProductPixel(src, p)) continue;
      if (pixelLum(out, p) < 252) continue;

      let nearMask = false;
      for (let dy = -FRINGE_PX; dy <= FRINGE_PX && !nearMask; dy++) {
        for (let dx = -FRINGE_PX; dx <= FRINGE_PX; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
          if (mask[yy * width + xx] >= MASK_APPLY_THRESH) nearMask = true;
        }
      }
      if (!nearMask) continue;
      if (isStudioBackgroundPixel(src, p)) {
        setRgb(out, p, BG, BG, BG, channels);
      }
    }
  }
}

export function cleanSofaCompositing(outBuffer, sourceImage, mask) {
  const { width, height, channels, data: src } = sourceImage;
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);

  preserveSourceProduct(out, src, mask, width, height, channels);
  forceWhiteBackground(out, src, mask, width, height, channels, box.maxY + 1);
  paintStudioFloorShadow(out, src, mask, width, height, channels, box);
  eraseFloorWhiteLines(out, src, mask, width, height, channels, box);
  preserveSourceProduct(out, src, mask, width, height, channels);
  snapWhiteHalos(out, src, mask, width, height, channels, box);

  return out;
}
