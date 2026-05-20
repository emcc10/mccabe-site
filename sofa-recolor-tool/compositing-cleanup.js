/**
 * Seamless #ffffff + unified grounding shadow + floor artifact removal.
 */
import { MASK_APPLY_THRESH, isNearWhite } from './render-sofas.js';

const BG = 255;
const FLOOR_SHADOW_MAX = 30;
const FLOOR_FALLOFF_ROWS = 88;
const FLOOR_BAND_ABOVE = 6;
const FRINGE_PX = 3;
const RAIL_BAND_ROWS = 8;
const WHITE_LINE_LUM = 238;

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

function setRgb(out, p, v, channels) {
  out[p] = v;
  out[p + 1] = v;
  out[p + 2] = v;
  if (channels === 4) out[p + 3] = 255;
}

/** Pure white everywhere above the floor band (outside upholstery). */
function forceWhiteCanvas(out, mask, width, height, channels, floorBandStart) {
  for (let y = 0; y < floorBandStart; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      setRgb(out, j * channels, BG, channels);
    }
  }
}

/** One continuous full-width grounding shadow — overwrites floor band entirely. */
function paintUnifiedFloorShadow(out, mask, width, height, channels, box) {
  const y0 = box.maxY + 1;
  const yStart = Math.max(0, box.maxY - FLOOR_BAND_ABOVE);
  for (let y = yStart; y < height; y++) {
    const shade = floorShade(y, y0);
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      setRgb(out, j * channels, shade, channels);
    }
  }
}

/** Repaint entire rows in floor band that still show white lines or fragments. */
function scrubFloorArtifacts(out, mask, width, height, channels, box) {
  const y0 = box.maxY + 1;
  const yStart = Math.max(0, box.maxY - FLOOR_BAND_ABOVE);
  const yEnd = Math.min(height, box.maxY + FLOOR_FALLOFF_ROWS + 16);

  for (let y = yStart; y < yEnd; y++) {
    let bright = 0;
    let n = 0;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      n++;
      if (pixelLum(out, j * channels) >= WHITE_LINE_LUM) bright++;
    }
    if (!n) continue;
    const brightFrac = bright / n;
    if (brightFrac < 0.06 && bright < 3) continue;

    const shade = floorShade(y, y0);
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH) continue;
      setRgb(out, j * channels, shade, channels);
    }
  }
}

/** Rail/feet fringe: white above floor; shadow shade in floor band (no fragmented patches). */
function cleanRailAndFringe(out, source, mask, width, height, channels, box) {
  const y0 = box.maxY + 1;
  const floorStart = Math.max(0, box.maxY - FLOOR_BAND_ABOVE);
  const yRail0 = Math.max(0, box.maxY - RAIL_BAND_ROWS);
  const yRail1 = Math.min(height - 1, box.maxY + 2);

  for (let y = yRail0; y <= yRail1; y++) {
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
            if (mask[yy * width + xx] >= MASK_APPLY_THRESH) nearMask = true;
          }
        }
        if (!nearMask) continue;
        if (y >= floorStart) {
          setRgb(out, p, floorShade(y, y0), channels);
        } else if (lum >= WHITE_LINE_LUM - 6) {
          setRgb(out, p, BG, channels);
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
            if (pixelLum(out, pk) > 245) continue;
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
      if (y >= floorStart) {
        if (lum > WHITE_LINE_LUM - 10) setRgb(out, p, floorShade(y, y0), channels);
        continue;
      }
      if (lum > 248 && !isNearWhite(source[srcP], source[srcP + 1], source[srcP + 2])) {
        setRgb(out, p, BG, channels);
      }
    }
  }
}

export function cleanSofaCompositing(outBuffer, sourceImage, mask) {
  const { width, height, channels } = sourceImage;
  const out = outBuffer;
  const box = maskBoundingBox(mask, width, height);
  const floorBandStart = Math.max(0, box.maxY - FLOOR_BAND_ABOVE);

  forceWhiteCanvas(out, mask, width, height, channels, floorBandStart);
  paintUnifiedFloorShadow(out, mask, width, height, channels, box);
  scrubFloorArtifacts(out, mask, width, height, channels, box);
  cleanRailAndFringe(out, sourceImage.data, mask, width, height, channels, box);
  paintUnifiedFloorShadow(out, mask, width, height, channels, box);

  return out;
}
