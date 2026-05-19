/**
 * Swatch texture extraction and transfer onto sofa (preserves sofa L / lighting).
 */
import { basename, extname, join, resolve } from 'path';
import sharp from 'sharp';
import {
  rgbToLab,
  labToRgb,
  pixelSaturation,
  isLightBodySampling,
  isNamedLightLeather,
  resolveOriginalSwatchPath,
  SWATCH_DIR,
} from './render-sofas.js';

const BG_THRESH = 238;
const TEXTURE_PATCH_SIZE = 384;
/** Subtle swatch luminance grain on sofa (sofa L dominates). */
const TEXTURE_L_DETAIL = 0.14;
const LIGHT_BODY_L_EXCLUDE = 60;
const LIGHT_BODY_L_SAMPLE = 70;
const LIGHT_BODY_L_SHADOW_MAX = 72;
const LIGHT_BODY_SAT_MIN = 0.02;
const LIGHT_BODY_SAT_MAX = 0.42;
const LIGHT_BODY_WARM_B_MIN = 6;
const LIGHT_BODY_WARM_A_MIN = -2;
const LIGHT_BODY_SHADOW_MIN_PIXELS = 80;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function isNearWhite(r, g, b) {
  return r > BG_THRESH && g > BG_THRESH && b > BG_THRESH;
}

function isWarmLightBodyPixel(labL, labA, labB, sat) {
  return (
    labB >= LIGHT_BODY_WARM_B_MIN &&
    labA >= LIGHT_BODY_WARM_A_MIN &&
    sat >= LIGHT_BODY_SAT_MIN &&
    sat <= LIGHT_BODY_SAT_MAX
  );
}

function pixelAt(data, width, channels, x, y) {
  const i = (y * width + x) * channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2], i };
}

function buildPixelMeta(data, width, height, channels) {
  const meta = new Array(width * height);
  const lumValues = [];

  for (let y = 0; y < height; y++) {
    for (let j = y * width, x = 0; x < width; x++, j++) {
      const { r, g, b } = pixelAt(data, width, channels, x, y);
      if (isNearWhite(r, g, b)) {
        meta[j] = null;
        continue;
      }
      const lab = rgbToLab(r, g, b);
      const sat = pixelSaturation(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const m = { r, g, b, labL: lab.L, labA: lab.a, labB: lab.b, sat, lum };
      meta[j] = m;
      lumValues.push(lum);
    }
  }

  lumValues.sort((a, b) => a - b);
  const p33 = lumValues[Math.floor(lumValues.length * 0.33)] ?? 0;
  const p66 = lumValues[Math.floor(lumValues.length * 0.66)] ?? 255;

  return { meta, p33, p66 };
}

function makeBandPredicates(swatchStem, meta, p33, p66) {
  if (isLightBodySampling(swatchStem)) {
    return {
      shadow: (m) =>
        m.labL >= LIGHT_BODY_L_EXCLUDE &&
        m.labL < LIGHT_BODY_L_SHADOW_MAX &&
        isWarmLightBodyPixel(m.labL, m.labA, m.labB, m.sat),
      midtone: (m) => m.labL > LIGHT_BODY_L_SAMPLE && isWarmLightBodyPixel(m.labL, m.labA, m.labB, m.sat),
      highlight: (m) => m.labL > LIGHT_BODY_L_SAMPLE && isWarmLightBodyPixel(m.labL, m.labA, m.labB, m.sat),
      midtoneRank: (m, body) => {
        const idx = body.findIndex((b) => b.j === meta.indexOf(m));
        return idx;
      },
    };
  }

  return {
    shadow: (m) => m.lum <= p33,
    midtone: (m) => m.lum > p33 && m.lum <= p66,
    highlight: (m) => m.lum > p66,
  };
}

function findBestPatchOrigin(mask, width, height, patchSize) {
  let bestScore = 0;
  let bestX = 0;
  let bestY = 0;
  const maxX = Math.max(1, width - patchSize);
  const maxY = Math.max(1, height - patchSize);

  for (let y = 0; y < maxY; y += 8) {
    for (let x = 0; x < maxX; x += 8) {
      let score = 0;
      for (let dy = 0; dy < patchSize; dy++) {
        const row = (y + dy) * width;
        for (let dx = 0; dx < patchSize; dx++) {
          if (mask[row + x + dx]) score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  if (bestScore < patchSize * 8) {
    for (let y = 0; y < maxY; y++) {
      for (let x = 0; x < maxX; x++) {
        let score = 0;
        for (let dy = 0; dy < patchSize; dy++) {
          const row = (y + dy) * width;
          for (let dx = 0; dx < patchSize; dx++) {
            if (mask[row + x + dx]) score++;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
  }

  return { x: bestX, y: bestY, score: bestScore };
}

function extractPatchFromSwatch(data, width, height, channels, originX, originY, patchSize) {
  const out = Buffer.alloc(patchSize * patchSize * channels);
  for (let dy = 0; dy < patchSize; dy++) {
    const sy = clamp(originY + dy, 0, height - 1);
    for (let dx = 0; dx < patchSize; dx++) {
      const sx = clamp(originX + dx, 0, width - 1);
      const si = (sy * width + sx) * channels;
      const di = (dy * patchSize + dx) * channels;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      if (channels === 4) out[di + 3] = data[si + 3];
    }
  }
  return { data: out, width: patchSize, height: patchSize, channels };
}

function computePatchStats(patch) {
  const { data, width, height, channels } = patch;
  const Ls = [];
  const as = [];
  const bs = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isNearWhite(r, g, b)) continue;
      const lab = rgbToLab(r, g, b);
      Ls.push(lab.L);
      as.push(lab.a);
      bs.push(lab.b);
    }
  }
  const med = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  };
  const meanL = med(Ls);
  const meanA = med(as);
  const meanB = med(bs);
  const { r, g, b: bOut } = labToRgb(meanL, meanA, meanB);
  return { meanL, meanA, meanB, rgb: [r, g, bOut], validPixels: Ls.length };
}

function buildBandMask(meta, width, height, predicate, bodyFilter) {
  const mask = new Uint8Array(width * height);
  const body = [];

  for (let j = 0; j < width * height; j++) {
    const m = meta[j];
    if (!m || !predicate(m)) continue;
    if (bodyFilter && !bodyFilter(m)) continue;
    mask[j] = 1;
    body.push({ j, m });
  }

  return { mask, body };
}

function buildLightBodyBandMasks(meta, width, height) {
  const warm = (m) => isWarmLightBodyPixel(m.labL, m.labA, m.labB, m.sat);

  const shadowMask = new Uint8Array(width * height);
  const body = [];
  for (let j = 0; j < width * height; j++) {
    const m = meta[j];
    if (!m) continue;
    if (m.labL >= LIGHT_BODY_L_EXCLUDE && m.labL < LIGHT_BODY_L_SHADOW_MAX && warm(m)) {
      shadowMask[j] = 1;
    }
    if (m.labL > LIGHT_BODY_L_SAMPLE && warm(m)) body.push({ j, m });
  }

  body.sort((a, b) => a.m.labL - b.m.labL);
  const n = body.length;
  const midSet = new Set(
    body.slice(Math.floor(n * 0.35), Math.floor(n * 0.65)).map((b) => b.j),
  );
  const hiSet = new Set(body.slice(Math.floor(n * 0.88)).map((b) => b.j));

  const midMask = new Uint8Array(width * height);
  const hiMask = new Uint8Array(width * height);
  for (const j of midSet) midMask[j] = 1;
  for (const j of hiSet) hiMask[j] = 1;

  let shadowUse = shadowMask;
  const shadowCount = shadowMask.reduce((a, v) => a + v, 0);
  if (shadowCount < LIGHT_BODY_SHADOW_MIN_PIXELS) {
    shadowUse = new Uint8Array(width * height);
    for (const { j } of body.slice(0, Math.max(1, Math.floor(n * 0.25)))) shadowUse[j] = 1;
  }

  return { shadow: shadowUse, midtone: midMask, highlight: hiMask };
}

function extractBandPatch(data, width, height, channels, bandMask, patchSize) {
  const origin = findBestPatchOrigin(bandMask, width, height, patchSize);
  const patch = extractPatchFromSwatch(
    data,
    width,
    height,
    channels,
    origin.x,
    origin.y,
    patchSize,
  );
  const stats = computePatchStats(patch);
  return { ...patch, origin, coverage: origin.score, stats };
}

function samplePatchRgb(patch, px, py) {
  const x = ((px % patch.width) + patch.width) % patch.width;
  const y = ((py % patch.height) + patch.height) % patch.height;
  const i = (y * patch.width + x) * patch.channels;
  return { r: patch.data[i], g: patch.data[i + 1], b: patch.data[i + 2] };
}

/**
 * Load swatch, extract three real texture patches (shadow / mid / highlight).
 */
export async function getSwatchTexture(swatchPath) {
  const resolved = resolveOriginalSwatchPath(swatchPath) || resolve(swatchPath);
  if (!resolved.startsWith(resolve(SWATCH_DIR))) {
    throw new Error(`Swatch must be under input/swatches: ${swatchPath}`);
  }

  const swatchStem = basename(resolved, extname(resolved));
  const { data, info } = await sharp(resolved).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const { meta, p33, p66 } = buildPixelMeta(data, width, height, channels);

  let patches;
  let extractionMethod;

  if (isLightBodySampling(swatchStem)) {
    const masks = buildLightBodyBandMasks(meta, width, height);
    patches = {
      shadow: extractBandPatch(data, width, height, channels, masks.shadow, TEXTURE_PATCH_SIZE),
      midtone: extractBandPatch(data, width, height, channels, masks.midtone, TEXTURE_PATCH_SIZE),
      highlight: extractBandPatch(data, width, height, channels, masks.highlight, TEXTURE_PATCH_SIZE),
    };
    extractionMethod = 'light-body-texture';
  } else {
    const preds = makeBandPredicates(swatchStem, meta, p33, p66);
    const shadowM = buildBandMask(meta, width, height, preds.shadow).mask;
    const midM = buildBandMask(meta, width, height, preds.midtone).mask;
    const hiM = buildBandMask(meta, width, height, preds.highlight).mask;
    patches = {
      shadow: extractBandPatch(data, width, height, channels, shadowM, TEXTURE_PATCH_SIZE),
      midtone: extractBandPatch(data, width, height, channels, midM, TEXTURE_PATCH_SIZE),
      highlight: extractBandPatch(data, width, height, channels, hiM, TEXTURE_PATCH_SIZE),
    };
    extractionMethod = 'tertile-texture';
  }

  return {
    patches,
    isNamedLight: isNamedLightLeather(swatchStem),
    isLightBodySampling: isLightBodySampling(swatchStem),
    extractionMethod,
    sourceFile: basename(resolved),
    swatchSize: { width, height },
  };
}

export function pickTexturePatch(texture, u) {
  const t = clamp(u, 0, 1);
  if (t < 1 / 3) return { patch: texture.patches.shadow, localU: t * 3 };
  if (t < 2 / 3) return { patch: texture.patches.midtone, localU: (t - 1 / 3) * 3 };
  return { patch: texture.patches.highlight, localU: (t - 2 / 3) * 3 };
}

export function sampleTextureLab(texture, sofaX, sofaY, u) {
  const { patch, localU } = pickTexturePatch(texture, u);
  const px =
    (sofaX * 1.07 + sofaY * 0.41 + Math.floor(localU * 97)) %
    patch.width;
  const py =
    (Math.floor(localU * (patch.height - 1)) + sofaX * 0.23 + sofaY * 0.19) %
    patch.height;
  const { r, g, b } = samplePatchRgb(patch, px, py);
  const lab = rgbToLab(r, g, b);
  return { lab, patch, patchMeanL: patch.stats.meanL };
}

export { TEXTURE_L_DETAIL };
