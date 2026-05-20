/**
 * Below sofa: pure white + one ellipse shadow + feet only.
 */
import { MASK_APPLY_THRESH } from './render-sofas.js';

const BG = 255;
const STRIP_ABOVE = 10;
const SHADOW_OPACITY = 0.13;
const DARK_LUM_MAX = 108;
const ELLIPSE_Y_OFFSET = 12;
const ELLIPSE_RY = 40;
const ELLIPSE_RX_PAD = 32;

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

function pixelLum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isDarkFoot(src, p) {
  return pixelLum(src[p], src[p + 1], src[p + 2]) <= DARK_LUM_MAX;
}

function setWhite(out, p, channels) {
  out[p] = BG;
  out[p + 1] = BG;
  out[p + 2] = BG;
  if (channels === 4) out[p + 3] = 255;
}

function copySource(out, src, p, channels) {
  out[p] = src[p];
  out[p + 1] = src[p + 1];
  out[p + 2] = src[p + 2];
  if (channels === 4) out[p + 3] = src[p + 3] ?? 255;
}

/**
 * Erase everything below sofa baseline except upholstery (mask) and dark feet.
 * Also clear transition strip above baseline (mask contamination).
 */
function eraseAllBelowBaseline(out, src, mask, width, height, channels, box) {
  const bottom = box.maxY;
  const x0 = Math.max(0, box.minX - 48);
  const x1 = Math.min(width - 1, box.maxX + 48);

  for (let y = bottom - STRIP_ABOVE; y < height; y++) {
    const belowBaseline = y > bottom;
    const inStrip = y <= bottom;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;

      if (inStrip && (x < x0 || x > x1)) continue;

      const p = j * channels;
      if (isDarkFoot(src, p)) {
        copySource(out, src, p, channels);
        continue;
      }

      if (belowBaseline || inStrip) {
        setWhite(out, p, channels);
      }
    }
  }
}

/** One soft ellipse shadow on white — only below baseline, not on feet. */
function paintEllipseShadow(out, src, mask, width, height, channels, box) {
  const bottom = box.maxY;
  const cx = (box.minX + box.maxX) * 0.5;
  const cy = bottom + ELLIPSE_Y_OFFSET;
  const rx = (box.maxX - box.minX) * 0.5 + ELLIPSE_RX_PAD;
  const ry = ELLIPSE_RY;

  for (let y = bottom + 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isDarkFoot(src, p)) continue;

      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1.5) continue;

      const falloff = Math.exp(-d2 * 2.2);
      const shade = Math.round(BG * (1 - SHADOW_OPACITY * falloff));
      out[p] = shade;
      out[p + 1] = shade;
      out[p + 2] = shade;
      if (channels === 4) out[p + 3] = 255;
    }
  }
}

function restoreFeet(out, src, mask, width, height, channels) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (isDarkFoot(src, p)) copySource(out, src, p, channels);
  }
}

export function cleanSofaCompositing(outBuffer, sourceImage, mask) {
  const { width, height, channels, data: src } = sourceImage;
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);

  eraseAllBelowBaseline(out, src, mask, width, height, channels, box);
  paintEllipseShadow(out, src, mask, width, height, channels, box);
  restoreFeet(out, src, mask, width, height, channels);

  return out;
}
