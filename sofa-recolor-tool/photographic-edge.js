/**
 * Restore original source edge antialiasing — no sharpen, no feather blur.
 */
import { MASK_APPLY_THRESH, rgbToLab, labToRgb } from './render-sofas.js';

const EDGE_RING_PX = 4;
const INSIDE_EDGE_BLEND = 0.18;
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

function setRgb(out, p, r, g, b, ch) {
  out[p] = r;
  out[p + 1] = g;
  out[p + 2] = b;
  if (ch === 4) out[p + 3] = 255;
}

function nearestMaskedRgb(out, mask, width, height, channels, x, y) {
  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
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
  return [200, 190, 175];
}

function isOutsideEdgeRing(mask, width, height, x, y) {
  for (let dy = -EDGE_RING_PX; dy <= EDGE_RING_PX; dy++) {
    for (let dx = -EDGE_RING_PX; dx <= EDGE_RING_PX; dx++) {
      if (dx === 0 && dy === 0) continue;
      const yy = y + dy;
      const xx = x + dx;
      if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
      if (mask[yy * width + xx] >= MASK_APPLY_THRESH) return true;
    }
  }
  return false;
}

function isOnMaskBoundary(mask, width, x, y) {
  if (mask[y * width + x] < MASK_APPLY_THRESH) return false;
  if (x > 0 && mask[y * width + (x - 1)] < MASK_APPLY_THRESH) return true;
  if (x < width - 1 && mask[y * width + (x + 1)] < MASK_APPLY_THRESH) return true;
  if (y > 0 && mask[(y - 1) * width + x] < MASK_APPLY_THRESH) return true;
  if (y < mask.length / width - 1 && mask[(y + 1) * width + x] < MASK_APPLY_THRESH) return true;
  return false;
}

/**
 * Outside mask: rebuild AA fringe from source coverage toward interior ivory.
 * Inside mask boundary: slight source-L blend for natural silhouette.
 */
export function restorePhotographicEdges(outBuffer, sourceImage, mask) {
  const { data: src, width, height, channels } = sourceImage;
  const out = outBuffer;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const p = j * channels;
      const sr = src[p];
      const sg = src[p + 1];
      const sb = src[p + 2];

      if (mask[j] >= MASK_APPLY_THRESH) {
        if (!isOnMaskBoundary(mask, width, x, y)) continue;
        const lab = rgbToLab(out[p], out[p + 1], out[p + 2]);
        const srcLab = rgbToLab(sr, sg, sb);
        const blend = INSIDE_EDGE_BLEND;
        const L = lab.L * (1 - blend) + srcLab.L * blend;
        const { r, g, b } = labToRgb(L, lab.a, lab.b);
        setRgb(out, p, r, g, b, channels);
        continue;
      }

      if (!isOutsideEdgeRing(mask, width, height, x, y)) continue;
      if (isDark(sr, sg, sb)) continue;

      const srcLum = pixelLum(sr, sg, sb);
      if (srcLum >= 252) {
        setRgb(out, p, 255, 255, 255, channels);
        continue;
      }

      const [ir, ig, ib] = nearestMaskedRgb(out, mask, width, height, channels, x, y);
      const t = clamp((248 - srcLum) / 100, 0, 1);
      if (t < 0.04) {
        setRgb(out, p, 255, 255, 255, channels);
      } else {
        setRgb(
          out,
          p,
          Math.round(255 * (1 - t) + ir * t),
          Math.round(255 * (1 - t) + ig * t),
          Math.round(255 * (1 - t) + ib * t),
          channels,
        );
      }
    }
  }

  return out;
}
