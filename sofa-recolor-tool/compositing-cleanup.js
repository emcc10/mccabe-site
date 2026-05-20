/**
 * Surgical bottom-band cleanup + single ellipse grounding shadow.
 */
import { MASK_APPLY_THRESH } from './render-sofas.js';

const BG = 255;
const ZONE_ABOVE = 12;
const ZONE_BELOW = 35;
const DARK_LUM_MAX = 108;
const SHADOW_OPACITY = 0.14;
const ELLIPSE_Y_OFFSET = 14;
const ELLIPSE_RY = 38;
const ELLIPSE_RX_PAD = 28;

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

function isDarkPixel(r, g, b) {
  return pixelLum(r, g, b) <= DARK_LUM_MAX;
}

function isNearWhiteFragment(out, p, channels) {
  const r = out[p];
  const g = out[p + 1];
  const b = out[p + 2];
  if (r > 205 && g > 205 && b > 195) return true;
  if (channels === 4 && out[p + 3] < 245) return true;
  return false;
}

function setWhite(out, p, channels) {
  out[p] = BG;
  out[p + 1] = BG;
  out[p + 2] = BG;
  if (channels === 4) out[p + 3] = 255;
}

function preserveDarkFeet(out, src, mask, width, height, channels) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    const r = src[p];
    const g = src[p + 1];
    const b = src[p + 2];
    if (!isDarkPixel(r, g, b)) continue;
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
    if (channels === 4) out[p + 3] = src[p + 3] ?? 255;
  }
}

/**
 * Hard pass: y > bottom - 12 && y < bottom + 35 — strip fragment pixels to #fff.
 */
function surgicalBottomBandCleanup(out, mask, width, height, channels, box) {
  const bottom = box.maxY;
  const yLo = bottom - ZONE_ABOVE + 1;
  const yHi = bottom + ZONE_BELOW - 1;

  for (let y = Math.max(0, yLo); y <= Math.min(height - 1, yHi); y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const p = j * channels;
      const r = out[p];
      const g = out[p + 1];
      const b = out[p + 2];
      if (isDarkPixel(r, g, b)) continue;
      if (!isNearWhiteFragment(out, p, channels)) continue;
      setWhite(out, p, channels);
    }
  }
}

/** Single soft blurred ellipse shadow under sofa (10–16% darken on white). */
function paintEllipseGroundShadow(out, src, mask, width, height, channels, box) {
  const cx = (box.minX + box.maxX) * 0.5;
  const cy = box.maxY + ELLIPSE_Y_OFFSET;
  const rx = (box.maxX - box.minX) * 0.5 + ELLIPSE_RX_PAD;
  const ry = ELLIPSE_RY;
  const yMin = box.maxY + 1;
  const yMax = Math.min(height - 1, box.maxY + ZONE_BELOW + 18);

  for (let y = yMin; y <= yMax; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      const sr = src[p];
      const sg = src[p + 1];
      const sb = src[p + 2];
      if (isDarkPixel(sr, sg, sb)) continue;

      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1.35) continue;

      const falloff = Math.exp(-d2 * 2.4);
      const shade = Math.round(BG * (1 - SHADOW_OPACITY * falloff));
      out[p] = shade;
      out[p + 1] = shade;
      out[p + 2] = shade;
      if (channels === 4) out[p + 3] = 255;
    }
  }
}

export function cleanSofaCompositing(outBuffer, sourceImage, mask) {
  const { width, height, channels, data: src } = sourceImage;
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);

  surgicalBottomBandCleanup(out, mask, width, height, channels, box);
  paintEllipseGroundShadow(out, src, mask, width, height, channels, box);
  preserveDarkFeet(out, src, mask, width, height, channels);

  return out;
}
