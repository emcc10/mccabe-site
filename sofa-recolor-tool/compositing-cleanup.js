/**
 * Pure #ffffff background + natural contact shadow only.
 */
import { MASK_APPLY_THRESH } from './render-sofas.js';

const BG = 255;
const SHADOW_MAX_DROP = 26;
const SHADOW_ROWS = 64;
const FRINGE_PX = 3;

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

function setRgb(out, p, r, g, b, channels) {
  out[p] = r;
  out[p + 1] = g;
  out[p + 2] = b;
  if (channels === 4) out[p + 3] = 255;
}

/** Entire non-upholstery area → #ffffff. */
function forcePureWhite(out, mask, width, height, channels) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] >= MASK_APPLY_THRESH) continue;
    setRgb(out, j * channels, BG, BG, BG, channels);
  }
}

/** Single soft contact shadow; no gray gradients elsewhere. */
function paintContactShadow(out, mask, width, height, channels, box) {
  const x0 = Math.max(0, box.minX - 12);
  const x1 = Math.min(width - 1, box.maxX + 12);
  const y0 = box.maxY + 1;

  for (let y = y0; y < height; y++) {
    const t = clamp((y - y0) / SHADOW_ROWS, 0, 1);
    const shade = Math.round(BG - t * SHADOW_MAX_DROP);
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      if (x < x0 || x > x1) {
        setRgb(out, j * channels, BG, BG, BG, channels);
        continue;
      }
      setRgb(out, j * channels, shade, shade, shade, channels);
    }
  }
}

/** Remove horizontal artifact lines in shadow band. */
function removeHorizontalArtifacts(out, mask, width, height, channels, box) {
  for (let y = box.maxY; y < Math.min(height, box.maxY + SHADOW_ROWS + 8); y++) {
    let bright = 0;
    let dark = 0;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      const lum = 0.2126 * out[p] + 0.7152 * out[p + 1] + 0.0722 * out[p + 2];
      if (lum > 252) bright++;
      else if (lum < 235) dark++;
    }
    if (bright < width * 0.08 || dark < width * 0.05) continue;
    const t = clamp((y - box.maxY) / SHADOW_ROWS, 0, 1);
    const shade = Math.round(BG - t * SHADOW_MAX_DROP);
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      setRgb(out, j * channels, shade, shade, shade, channels);
    }
  }
}

function cleanFringe(out, mask, width, height, channels, box) {
  for (let y = Math.max(0, box.minY); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      let near = false;
      for (let dy = -FRINGE_PX; dy <= FRINGE_PX && !near; dy++) {
        for (let dx = -FRINGE_PX; dx <= FRINGE_PX; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
          if (mask[yy * width + xx] >= MASK_APPLY_THRESH) near = true;
        }
      }
      if (!near) continue;
      const p = j * channels;
      const lum = 0.2126 * out[p] + 0.7152 * out[p + 1] + 0.0722 * out[p + 2];
      if (lum > 250) setRgb(out, p, BG, BG, BG, channels);
    }
  }
}

export function applyPhotographicBackground(outBuffer, mask, width, height, channels) {
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);
  forcePureWhite(out, mask, width, height, channels);
  paintContactShadow(out, mask, width, height, channels, box);
  removeHorizontalArtifacts(out, mask, width, height, channels, box);
  cleanFringe(out, mask, width, height, channels, box);
  return out;
}
