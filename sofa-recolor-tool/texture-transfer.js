/**
 * Swatch texture → sofa transfer maps (fixed integer UV, valid-pixel sampling).
 */
import convert from 'color-convert';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';

const MASK_APPLY_THRESH = 128;
const SOFA_L_MAP_LO = 0.08;
const SOFA_L_MAP_HI = 0.92;
const SOFA_L_MAP_MIN_SPAN = 4;
const BG_THRESH = 238;
const MIN_ALPHA = 20;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function isNearWhite(r, g, b) {
  return r > BG_THRESH && g > BG_THRESH && b > BG_THRESH;
}

function pixelBrightness(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToLab(r, g, b) {
  const lab = convert.rgb.lab([r, g, b]);
  return { L: lab[0], a: lab[1], b: lab[2] };
}

function percentileOfSorted(sorted, p) {
  if (!sorted.length) return 0;
  const idx = clamp(Math.floor(sorted.length * p), 0, sorted.length - 1);
  return sorted[idx];
}

function computeSofaLuminanceMapRange(masterImage, mask) {
  const { data, width, height, channels } = masterImage;
  const Ls = [];
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    Ls.push(rgbToLab(data[p], data[p + 1], data[p + 2]).L);
  }
  Ls.sort((a, b) => a - b);
  const lo = percentileOfSorted(Ls, SOFA_L_MAP_LO);
  const hi = percentileOfSorted(Ls, SOFA_L_MAP_HI);
  return { lo, hi, span: Math.max(hi - lo, SOFA_L_MAP_MIN_SPAN) };
}

function bandNameFromU(u) {
  if (u < 1 / 3) return 'shadow';
  if (u < 2 / 3) return 'midtone';
  return 'highlight';
}

export function pickTexturePatch(texture, u) {
  const t = clamp(u, 0, 1);
  if (t < 1 / 3) return { patch: texture.patches.shadow, localU: t * 3 };
  if (t < 2 / 3) return { patch: texture.patches.midtone, localU: (t - 1 / 3) * 3 };
  return { patch: texture.patches.highlight, localU: (t - 2 / 3) * 3 };
}

export { bandNameFromU };

/** Integer sofa (x,y) → patch UV; band from sofa luminance u only. */
export function resolveTextureSample(texture, sofaX, sofaY, u) {
  const { patch } = pickTexturePatch(texture, u);
  const band = bandNameFromU(u);
  const px = ((sofaX % patch.width) + patch.width) % patch.width;
  const py = ((sofaY % patch.height) + patch.height) % patch.height;
  return { band, patch, px, py };
}

function readPatchPixel(patch, x, y) {
  const px = ((x % patch.width) + patch.width) % patch.width;
  const py = ((y % patch.height) + patch.height) % patch.height;
  const i = (py * patch.width + px) * patch.channels;
  const r = patch.data[i];
  const g = patch.data[i + 1];
  const b = patch.data[i + 2];
  const a = patch.channels === 4 ? patch.data[i + 3] : 255;
  return { r, g, b, a };
}

/** Sample leather pixel only; spiral search avoids white/transparent patch areas. */
export function samplePatchRgbValid(patch, px, py) {
  const startX = Math.floor(px);
  const startY = Math.floor(py);
  const fallback = patch.stats?.rgb ?? [128, 128, 128];

  for (let radius = 0; radius < 24; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const { r, g, b, a } = readPatchPixel(patch, startX + dx, startY + dy);
        if (a < MIN_ALPHA || isNearWhite(r, g, b)) continue;
        return { r, g, b };
      }
    }
  }

  return { r: fallback[0], g: fallback[1], b: fallback[2] };
}

/**
 * Build per-sofa-pixel transfer maps (masked upholstery only).
 * rgbMap / uvMap / bandMap are width×height×3 (black outside mask).
 */
export function buildTransferMaps(masterImage, mask, texture) {
  const { data, width, height, channels } = masterImage;
  const { lo, span } = computeSofaLuminanceMapRange(masterImage, mask);

  const rgbMap = Buffer.alloc(width * height * 3, 0);
  const uvMap = Buffer.alloc(width * height * 3, 0);
  const bandMap = Buffer.alloc(width * height * 3, 0);

  let masked = 0;
  let sumBright = 0;
  let darkCount = 0;
  let speckleCount = 0;
  let invalidCount = 0;

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;

    const x = j % width;
    const y = (j / width) | 0;
    const p = j * channels;
    const masterLab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    const u = clamp((masterLab.L - lo) / span, 0, 1);

    const { band, patch, px, py } = resolveTextureSample(texture, x, y, u);
    const rgb = samplePatchRgbValid(patch, px, py);

    if (!Number.isFinite(rgb.r) || !Number.isFinite(rgb.g) || !Number.isFinite(rgb.b)) {
      invalidCount++;
      continue;
    }

    const o = j * 3;
    rgbMap[o] = rgb.r;
    rgbMap[o + 1] = rgb.g;
    rgbMap[o + 2] = rgb.b;

    uvMap[o] = Math.round((px / Math.max(1, patch.width - 1)) * 255);
    uvMap[o + 1] = Math.round((py / Math.max(1, patch.height - 1)) * 255);
    uvMap[o + 2] = Math.round(u * 255);

    const bandGray = band === 'shadow' ? 64 : band === 'midtone' ? 128 : 192;
    bandMap[o] = bandGray;
    bandMap[o + 1] = bandGray;
    bandMap[o + 2] = bandGray;

    const bright = pixelBrightness(rgb.r, rgb.g, rgb.b);
    sumBright += bright;
    masked++;
    if (bright < 22) darkCount++;

    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const sat = max === min ? 0 : (max - min) / (max + min < 255 ? max + min : 510);
    if (bright < 35 && sat > 0.12) speckleCount++;
  }

  return {
    rgbMap,
    uvMap,
    bandMap,
    width,
    height,
    stats: {
      masked,
      meanBright: masked ? sumBright / masked : 0,
      darkFrac: masked ? darkCount / masked : 1,
      speckleFrac: masked ? speckleCount / masked : 0,
      invalidCount,
    },
  };
}

/**
 * Abort if transfer map looks like black blob + colored speckles (broken sampling).
 */
export function validateTransferRgbMap(maps, mask) {
  const { stats, rgbMap, width, height } = maps;
  if (!stats.masked) {
    throw new Error('Texture transfer: no masked upholstery pixels');
  }

  const { meanBright, darkFrac, speckleFrac, invalidCount } = stats;

  if (invalidCount > stats.masked * 0.01) {
    throw new Error(
      `Texture transfer: ${invalidCount} invalid RGB samples (NaN/non-finite)`,
    );
  }

  if (meanBright < 28) {
    throw new Error(
      `Texture transfer map too dark (mean brightness ${meanBright.toFixed(1)}). ` +
        'Sampling is likely broken — check debug-sampled-rgb.png',
    );
  }

  if (darkFrac > 0.5) {
    throw new Error(
      `Texture transfer map is ${(darkFrac * 100).toFixed(0)}% near-black pixels. ` +
        'Expected visible leather texture — check debug outputs.',
    );
  }

  if (speckleFrac > 0.06 && meanBright < 55) {
    throw new Error(
      `Texture transfer speckle failure: ${(speckleFrac * 100).toFixed(1)}% saturated dark pixels ` +
        `(Christmas-light pattern). Check debug-sampled-rgb.png before rendering sofa.`,
    );
  }

  let labInvalid = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const o = j * 3;
    const lab = rgbToLab(rgbMap[o], rgbMap[o + 1], rgbMap[o + 2]);
    if (!Number.isFinite(lab.L) || !Number.isFinite(lab.a) || !Number.isFinite(lab.b)) {
      labInvalid++;
    }
  }
  if (labInvalid > stats.masked * 0.01) {
    throw new Error(`Texture transfer: ${labInvalid} pixels failed LAB conversion`);
  }

  return stats;
}

export async function saveDebugPng(data, path, width, height, channels = 3) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(data, { raw: { width, height, channels } }).png().toFile(path);
}

/** Write transfer debug images; returns paths. */
export async function saveTransferDebugImages(maps, mask, outDir) {
  const { rgbMap, uvMap, bandMap, width, height } = maps;
  const maskedRgb = Buffer.alloc(width * height * 3, 0);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const o = j * 3;
    maskedRgb[o] = rgbMap[o];
    maskedRgb[o + 1] = rgbMap[o + 1];
    maskedRgb[o + 2] = rgbMap[o + 2];
  }

  const paths = {
    sampledRgb: `${outDir}/debug-sampled-rgb.png`,
    uvLookup: `${outDir}/debug-sofa-uv-lookup.png`,
    bandAssignment: `${outDir}/debug-band-assignment.png`,
    sampledRgbMasked: `${outDir}/debug-sampled-rgb-masked.png`,
  };

  await saveDebugPng(rgbMap, paths.sampledRgb, width, height, 3);
  await saveDebugPng(uvMap, paths.uvLookup, width, height, 3);
  await saveDebugPng(bandMap, paths.bandAssignment, width, height, 3);
  await saveDebugPng(maskedRgb, paths.sampledRgbMasked, width, height, 3);

  return paths;
}
