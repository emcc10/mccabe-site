/**
 * Pure RGB(255,255,255) everywhere except sofa, feet, and a tiny contact shadow.
 */
import { MASK_APPLY_THRESH } from './render-sofas.js';

const BG = 255;
const DARK_LUM_MAX = 108;
const SHADOW_MAX_DROP = 11;
const SHADOW_OPACITY = 0.045;
const ELLIPSE_Y_OFFSET = 5;
const ELLIPSE_RY = 12;
const ELLIPSE_RX_SCALE = 0.26;
const SHADOW_ROWS = 16;

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

/** Step 1: entire frame outside upholstery → #ffffff (kills source vignette). */
function paintPureWhiteBackground(out, src, mask, width, height, channels) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (isDarkFoot(src, p)) continue;
    setWhite(out, p, channels);
  }
}

function isInContactShadow(x, y, box) {
  const bottom = box.maxY;
  if (y <= bottom || y > bottom + SHADOW_ROWS) return false;
  const cx = (box.minX + box.maxX) * 0.5;
  const cy = bottom + ELLIPSE_Y_OFFSET;
  const rx = Math.max(36, (box.maxX - box.minX) * ELLIPSE_RX_SCALE);
  const ry = ELLIPSE_RY;
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  const d2 = dx * dx + dy * dy;
  if (d2 > 0.72) return false;
  const falloff = Math.exp(-d2 * 4.5);
  const drop = SHADOW_MAX_DROP * falloff * (SHADOW_OPACITY / 0.045);
  return drop >= 1.5;
}

function contactShadowShade(x, y, box) {
  const bottom = box.maxY;
  const cx = (box.minX + box.maxX) * 0.5;
  const cy = bottom + ELLIPSE_Y_OFFSET;
  const rx = Math.max(36, (box.maxX - box.minX) * ELLIPSE_RX_SCALE);
  const ry = ELLIPSE_RY;
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  const d2 = dx * dx + dy * dy;
  const falloff = Math.exp(-d2 * 4.5);
  const drop = SHADOW_MAX_DROP * falloff * (SHADOW_OPACITY / 0.045);
  return Math.round(BG - drop);
}

/** Step 2: only mark shadow where shade is visibly below white. */
function paintContactShadow(out, src, mask, width, height, channels, box) {
  const bottom = box.maxY;
  const cx = (box.minX + box.maxX) * 0.5;
  const rx = Math.max(36, (box.maxX - box.minX) * ELLIPSE_RX_SCALE);
  const x0 = Math.max(0, Math.floor(cx - rx - 2));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx + 2));
  const yEnd = Math.min(height - 1, bottom + SHADOW_ROWS);

  for (let y = bottom + 1; y <= yEnd; y++) {
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isDarkFoot(src, p)) continue;
      if (!isInContactShadow(x, y, box)) continue;

      const shade = contactShadowShade(x, y, box);
      if (shade >= 252) continue;
      out[p] = shade;
      out[p + 1] = shade;
      out[p + 2] = shade;
      if (channels === 4) out[p + 3] = 255;
    }
  }
}

/** Step 3: final guarantee — white unless sofa, foot, or contact shadow pixel. */
function enforcePureWhiteFinal(out, src, mask, width, height, channels, box) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (isDarkFoot(src, p)) continue;

    const x = j % width;
    const y = Math.floor(j / width);
    if (isInContactShadow(x, y, box) && pixelLum(out[p], out[p + 1], out[p + 2]) < 252) {
      continue;
    }
    setWhite(out, p, channels);
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

  paintPureWhiteBackground(out, src, mask, width, height, channels);
  paintContactShadow(out, src, mask, width, height, channels, box);
  restoreFeet(out, src, mask, width, height, channels);
  enforcePureWhiteFinal(out, src, mask, width, height, channels, box);

  return out;
}
