/**
 * Floor/edge compositing cleanup — no geometry repaint.
 */
import { MASK_APPLY_THRESH, isNearWhite } from './render-sofas.js';

const FLOOR_SHADOW_MAX = 30;
const FLOOR_FALLOFF_ROWS = 88;
const FRINGE_PX = 4;
const RAIL_BAND_ROWS = 10;
const WHITE_LINE_LUM = 248;

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

function rowWhiteFraction(data, y, width, channels, x0, x1) {
  let white = 0;
  let n = 0;
  for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * channels;
    if (pixelLum(data, p) >= WHITE_LINE_LUM) white++;
    n++;
  }
  return n ? white / n : 0;
}

/** Full-width soft contact shadow under sofa. */
function paintFloorShadow(out, mask, width, height, channels, box) {
  const y0 = box.maxY + 1;
  for (let y = y0; y < height; y++) {
    const t = clamp((y - y0) / FLOOR_FALLOFF_ROWS, 0, 1);
    const shade = Math.round(255 - t * t * FLOOR_SHADOW_MAX);
    for (let x = 0; x < width; x++) {
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

/** Kill horizontal white/remnant lines in floor + rail band. */
function eraseFloorWhiteLines(out, mask, width, height, channels, box) {
  const yEnd = Math.min(height - 1, box.maxY + FLOOR_FALLOFF_ROWS);
  for (let y = box.maxY - 2; y < yEnd; y++) {
    const whiteFrac = rowWhiteFraction(out, y, width, channels, 0, width - 1);
    if (whiteFrac < 0.35) continue;
    const t = clamp((y - box.maxY) / FLOOR_FALLOFF_ROWS, 0, 1);
    const shade = Math.round(255 - t * t * FLOOR_SHADOW_MAX);
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      const p = j * channels;
      if (pixelLum(out, p) >= WHITE_LINE_LUM) {
        out[p] = shade;
        out[p + 1] = shade;
        out[p + 2] = shade;
      }
    }
  }
}

/** Base rail / feet fringe: snap stray bright pixels to white or shadow. */
function cleanRailAndFringe(out, source, mask, width, height, channels, box) {
  const y0 = Math.max(0, box.maxY - RAIL_BAND_ROWS);
  const y1 = Math.min(height - 1, box.maxY + RAIL_BAND_ROWS);

  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const p = j * channels;
      const lum = pixelLum(out, p);
      const onMask = mask[j] >= MASK_APPLY_THRESH;

      if (!onMask) {
        let nearMask = false;
        for (let dy = -FRINGE_PX; dy <= FRINGE_PX && !nearMask; dy++) {
          for (let dx = -FRINGE_PX; dx <= FRINGE_PX; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
            if (mask[yy * width + xx] >= MASK_APPLY_THRESH) {
              nearMask = true;
              break;
            }
          }
        }
        if (!nearMask) continue;
        if (lum >= WHITE_LINE_LUM - 4) {
          out[p] = 255;
          out[p + 1] = 255;
          out[p + 2] = 255;
        }
        continue;
      }

      if (y >= box.maxY - 2 && lum > 246) {
        let ar = 0;
        let ag = 0;
        let ab = 0;
        let n = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy < box.minY || yy > box.maxY || xx < box.minX || xx > box.maxX) continue;
            const k = yy * width + xx;
            if (mask[k] < MASK_APPLY_THRESH) continue;
            const pk = k * channels;
            const pl = pixelLum(out, pk);
            if (pl > 245) continue;
            ar += out[pk];
            ag += out[pk + 1];
            ab += out[pk + 2];
            n++;
          }
        }
        if (n > 0) {
          out[p] = Math.round(ar / n);
          out[p + 1] = Math.round(ag / n);
          out[p + 2] = Math.round(ab / n);
        }
      }
    }
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      let nearMask = false;
      for (let dy = -FRINGE_PX; dy <= FRINGE_PX && !nearMask; dy++) {
        for (let dx = -FRINGE_PX; dx <= FRINGE_PX; dx++) {
          if (mask[(y + dy) * width + (x + dx)] >= MASK_APPLY_THRESH) nearMask = true;
        }
      }
      if (!nearMask) continue;
      const p = j * channels;
      const lum = pixelLum(out, p);
      const srcP = j * channels;
      if (lum > 248 && !isNearWhite(source[srcP], source[srcP + 1], source[srcP + 2])) {
        out[p] = 255;
        out[p + 1] = 255;
        out[p + 2] = 255;
      }
    }
  }
}

export function cleanSofaCompositing(outBuffer, sourceImage, mask) {
  const { width, height, channels } = sourceImage;
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);

  paintFloorShadow(out, mask, width, height, channels, box);
  eraseFloorWhiteLines(out, mask, width, height, channels, box);
  cleanRailAndFringe(out, sourceImage.data, mask, width, height, channels, box);

  return out;
}
