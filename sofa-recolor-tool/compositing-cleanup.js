/**
 * Studio floor: continuous shadow, no off-white line artifacts; feet from source.
 */
import { MASK_APPLY_THRESH, isNearWhite } from './render-sofas.js';

const BG = 255;
const FLOOR_SHADOW_MAX = 32;
const FLOOR_FALLOFF_ROWS = 88;
const FRINGE_PX = 3;
const OFF_WHITE_LUM = 228;
const WHITE_LINE_LUM = 244;
const PRODUCT_LUM_MAX = 108;
const SOFA_X_PAD = 24;

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
  return Math.round(BG - t * t * FLOOR_SHADOW_MAX);
}

function isPreservedProductPixel(src, p) {
  return pixelLum(src, p) <= PRODUCT_LUM_MAX;
}

function copySourcePixel(out, src, p, channels) {
  out[p] = src[p];
  out[p + 1] = src[p + 1];
  out[p + 2] = src[p + 2];
  if (channels === 4) out[p + 3] = src[p + 3] ?? 255;
}

function setGray(out, p, v, channels) {
  out[p] = v;
  out[p + 1] = v;
  out[p + 2] = v;
  if (channels === 4) out[p + 3] = 255;
}

function preserveSourceFeet(out, src, mask, width, height, channels) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (isPreservedProductPixel(src, p)) copySourcePixel(out, src, p, channels);
  }
}

/** One continuous grounding shadow (below sofa base). */
function paintContinuousFloorShadow(out, src, mask, width, height, channels, box) {
  const y0 = box.maxY + 1;
  for (let y = y0; y < height; y++) {
    const shade = floorShade(y, y0);
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isPreservedProductPixel(src, p)) continue;
      setGray(out, p, shade, channels);
    }
  }
}

/**
 * Remove off-white horizontal lines / mask fringe in transition band under sofa.
 */
function removeOffWhiteFloorArtifacts(out, src, mask, width, height, channels, box) {
  const y0 = box.maxY + 1;
  const x0 = Math.max(0, box.minX - SOFA_X_PAD);
  const x1 = Math.min(width - 1, box.maxX + SOFA_X_PAD);
  const yStart = Math.max(0, box.maxY - 5);
  const yEnd = Math.min(height - 1, box.maxY + FLOOR_FALLOFF_ROWS);

  for (let y = yStart; y <= yEnd; y++) {
    let feet = 0;
    let offWhite = 0;
    let n = 0;
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      n++;
      const p = j * channels;
      if (isPreservedProductPixel(src, p)) feet++;
      const lum = pixelLum(out, p);
      if (lum >= OFF_WHITE_LUM) offWhite++;
    }
    if (feet > 2) continue;

    const shade = y >= y0 ? floorShade(y, y0) : floorShade(y0, y0);
    const repaintRow =
      offWhite >= 2 ||
      offWhite / Math.max(n, 1) > 0.04 ||
      (y >= box.maxY - 2 && y <= box.maxY + 3 && offWhite > 0);

    if (!repaintRow) continue;

    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isPreservedProductPixel(src, p)) continue;
      const lum = pixelLum(out, p);
      if (lum >= OFF_WHITE_LUM || lum >= WHITE_LINE_LUM - 8) {
        setGray(out, p, shade, channels);
      }
    }
  }
}

/** White halos beside upholstery above floor only — never white in floor band. */
function cleanUpperFringe(out, source, mask, width, height, channels, box) {
  const yMax = Math.max(0, box.maxY - 2);
  for (let y = Math.max(0, box.minY); y <= yMax; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isPreservedProductPixel(source, p)) continue;

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

      const lum = pixelLum(out, p);
      if (lum > 248 && !isNearWhite(source[p], source[p + 1], source[p + 2])) {
        setGray(out, p, BG, channels);
      }
    }
  }
}

export function cleanSofaCompositing(outBuffer, sourceImage, mask) {
  const { width, height, channels, data: src } = sourceImage;
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);

  preserveSourceFeet(out, src, mask, width, height, channels);
  removeOffWhiteFloorArtifacts(out, src, mask, width, height, channels, box);
  paintContinuousFloorShadow(out, src, mask, width, height, channels, box);
  removeOffWhiteFloorArtifacts(out, src, mask, width, height, channels, box);
  paintContinuousFloorShadow(out, src, mask, width, height, channels, box);
  cleanUpperFringe(out, src, mask, width, height, channels, box);
  preserveSourceFeet(out, src, mask, width, height, channels);

  return out;
}
