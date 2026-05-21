/**
 * Final pass only — after recolor. Touches background/bottom band, never upholstery.
 */
import { MASK_APPLY_THRESH } from './render-sofas.js';

const BG = 255;
const BAND_START = 0;
const BAND_END = 36;
const DARK_LUM_MAX = 108;
const SHADOW_MAX_DROP = 10;
const ELLIPSE_Y_OFFSET = 4;
const ELLIPSE_RY = 11;
const ELLIPSE_RX_SCALE = 0.24;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function maskBoundingBox(mask, width, height) {
  let minX = width;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] < MASK_APPLY_THRESH) continue;
      any = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return any ? { minX, maxX, maxY } : { minX: 0, maxX: width - 1, maxY: height - 1 };
}

function lum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isFoot(src, p) {
  return lum(src[p], src[p + 1], src[p + 2]) <= DARK_LUM_MAX;
}

function setWhite(out, p, ch) {
  out[p] = BG;
  out[p + 1] = BG;
  out[p + 2] = BG;
  if (ch === 4) out[p + 3] = 255;
}

function copySrc(out, src, p, ch) {
  out[p] = src[p];
  out[p + 1] = src[p + 1];
  out[p + 2] = src[p + 2];
  if (ch === 4) out[p + 3] = src[p + 3] ?? 255;
}

function shadowShade(x, y, box) {
  const bottom = box.maxY;
  const cx = (box.minX + box.maxX) * 0.5;
  const cy = bottom + ELLIPSE_Y_OFFSET;
  const rx = Math.max(32, (box.maxX - box.minX) * ELLIPSE_RX_SCALE);
  const ry = ELLIPSE_RY;
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  const d2 = dx * dx + dy * dy;
  if (d2 > 0.7) return BG;
  const falloff = Math.exp(-d2 * 4.8);
  const drop = SHADOW_MAX_DROP * falloff;
  return drop < 1 ? BG : Math.round(BG - drop);
}

function isShadowPixel(x, y, box) {
  return shadowShade(x, y, box) < 252;
}

/**
 * Runs once after recolor. Background → #fff; bottom band cleanup; tiny contact shadow.
 */
export function finalizeBaliExport(outBuffer, sourceImage, mask) {
  const { data: src, width, height, channels } = sourceImage;
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);
  const y0 = box.maxY + BAND_START;
  const y1 = Math.min(height - 1, box.maxY + BAND_END);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (isFoot(src, p)) copySrc(out, src, p, channels);
    else setWhite(out, p, channels);
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isFoot(src, p)) {
        copySrc(out, src, p, channels);
        continue;
      }
      const shade = shadowShade(x, y, box);
      if (shade < 252) {
        out[p] = shade;
        out[p + 1] = shade;
        out[p + 2] = shade;
        if (channels === 4) out[p + 3] = 255;
      } else {
        setWhite(out, p, channels);
      }
    }
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isFoot(src, p)) continue;
      if (isShadowPixel(x, y, box)) continue;
      setWhite(out, p, channels);
    }
  }

  /** Strip off-white contamination: band pixels that are not feet or contact shadow → #fff. */
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isFoot(src, p)) continue;
      if (isShadowPixel(x, y, box)) continue;
      const L = lum(out[p], out[p + 1], out[p + 2]);
      if (L >= 252) setWhite(out, p, channels);
      else if (L > 235) setWhite(out, p, channels);
    }
  }

  restoreFeetInBand(out, src, mask, width, height, channels, y0, y1);
  return out;
}

function restoreFeetInBand(out, src, mask, width, height, channels, y0, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isFoot(src, p)) copySrc(out, src, p, channels);
    }
  }
}
