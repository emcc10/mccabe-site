/**
 * Full-frame #ffffff + tight contact shadow under sofa + feet.
 */
import { MASK_APPLY_THRESH } from './render-sofas.js';

const BG = 255;
const STRIP_ABOVE = 12;
const BRIGHT_LUM = 170;
const SHADOW_OPACITY = 0.09;
const DARK_LUM_MAX = 108;
const ELLIPSE_Y_OFFSET = 6;
const ELLIPSE_RY = 20;
const ELLIPSE_RX_SCALE = 0.38;
const SHADOW_ROWS = 32;

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

function isDarkFoot(src, p) {
  return pixelLum(src, p) <= DARK_LUM_MAX;
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

/** Every non-upholstery pixel → pure white (removes source vignette/gray). */
function forceFullFrameWhite(out, src, mask, width, height, channels) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (isDarkFoot(src, p)) continue;
    setWhite(out, p, channels);
  }
}

function wipeTransitionStrip(out, src, mask, width, height, channels, box) {
  const bottom = box.maxY;
  const x0 = Math.max(0, box.minX - 48);
  const x1 = Math.min(width - 1, box.maxX + 48);

  for (let y = bottom - STRIP_ABOVE; y <= bottom; y++) {
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isDarkFoot(src, p)) continue;
      setWhite(out, p, channels);
    }
  }
}

function floodBrightBelow(out, src, mask, width, height, channels, box) {
  const bottom = box.maxY;
  const x0 = Math.max(0, box.minX - 48);
  const x1 = Math.min(width - 1, box.maxX + 48);

  for (let y = bottom - STRIP_ABOVE; y < Math.min(height, bottom + SHADOW_ROWS + 8); y++) {
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isDarkFoot(src, p)) continue;
      if (pixelLum(out, p) >= BRIGHT_LUM) setWhite(out, p, channels);
    }
  }
}

/** Small soft contact shadow — close under sofa only, no wide gray floor. */
function paintTightContactShadow(out, src, mask, width, height, channels, box) {
  const bottom = box.maxY;
  const cx = (box.minX + box.maxX) * 0.5;
  const cy = bottom + ELLIPSE_Y_OFFSET;
  const rx = Math.max(40, (box.maxX - box.minX) * ELLIPSE_RX_SCALE);
  const ry = ELLIPSE_RY;
  const yEnd = Math.min(height - 1, bottom + SHADOW_ROWS);
  const x0 = Math.max(0, Math.floor(cx - rx - 4));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx + 4));

  for (let y = bottom + 1; y <= yEnd; y++) {
    for (let x = x0; x <= x1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (isDarkFoot(src, p)) continue;

      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1.1) continue;

      const falloff = Math.exp(-d2 * 3.5);
      const shade = Math.round(BG * (1 - SHADOW_OPACITY * falloff));
      out[p] = shade;
      out[p + 1] = shade;
      out[p + 2] = shade;
      if (channels === 4) out[p + 3] = 255;
    }
  }
}

/** Re-white everything outside sofa except feet and shadow core. */
function enforceWhiteOutsideShadow(out, src, mask, width, height, channels, box) {
  const bottom = box.maxY;
  const cx = (box.minX + box.maxX) * 0.5;
  const cy = bottom + ELLIPSE_Y_OFFSET;
  const rx = Math.max(40, (box.maxX - box.minX) * ELLIPSE_RX_SCALE);
  const ry = ELLIPSE_RY;

  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (isDarkFoot(src, p)) continue;

    const x = j % width;
    const y = Math.floor(j / width);
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const d2 = dx * dx + dy * dy;
    if (y > bottom && y <= bottom + SHADOW_ROWS && d2 <= 1.1) continue;

    if (pixelLum(out, p) < BG) setWhite(out, p, channels);
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

  forceFullFrameWhite(out, src, mask, width, height, channels);
  wipeTransitionStrip(out, src, mask, width, height, channels, box);
  floodBrightBelow(out, src, mask, width, height, channels, box);
  paintTightContactShadow(out, src, mask, width, height, channels, box);
  enforceWhiteOutsideShadow(out, src, mask, width, height, channels, box);
  restoreFeet(out, src, mask, width, height, channels);

  return out;
}
