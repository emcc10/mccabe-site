/**
 * Swatch texture extraction and transfer onto sofa (preserves sofa L / lighting).
 */
import convert from 'color-convert';
import { existsSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SWATCH_DIR = join(__dirname, 'input', 'swatches');

const BG_THRESH = 238;
const TEXTURE_PATCH_SIZE = 384;
export const TEXTURE_L_DETAIL = 0.14;

const LIGHT_LEATHER_KEYWORDS = ['silk', 'eggshell', 'frost', 'parchment', 'vanilla', 'tusk', 'mist'];
const LIGHT_BODY_SAMPLING_KEYWORDS = ['silk', 'eggshell', 'vanilla', 'parchment'];
const LIGHT_BODY_L_EXCLUDE = 60;
const LIGHT_BODY_L_SAMPLE = 70;
const LIGHT_BODY_L_SHADOW_MAX = 72;
const LIGHT_BODY_SAT_MIN = 0.02;
const LIGHT_BODY_SAT_MAX = 0.42;
const LIGHT_BODY_WARM_B_MIN = 6;
const LIGHT_BODY_WARM_A_MIN = -2;
const LIGHT_BODY_SHADOW_MIN_PIXELS = 80;

const SWATCH_ID_PATTERN = /^[a-z]+-[a-z]+\.(jpe?g|png|webp)$/i;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rgbToLab(r, g, b) {
  const lab = convert.rgb.lab([r, g, b]);
  return { L: lab[0], a: lab[1], b: lab[2] };
}

function labToRgb(L, a, b) {
  const [r, g, bOut] = convert.lab.rgb([L, a, b]);
  return {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(bOut), 0, 255),
  };
}

function pixelSaturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  return (max - min) / (max + min < 255 ? max + min : 510);
}

function isNearWhite(r, g, b) {
  return r > BG_THRESH && g > BG_THRESH && b > BG_THRESH;
}

export function isNamedLightLeather(swatchStem) {
  const s = swatchStem.toLowerCase();
  return LIGHT_LEATHER_KEYWORDS.some((k) => s.includes(k));
}

export function isLightBodySampling(swatchStem) {
  const s = swatchStem.toLowerCase();
  return LIGHT_BODY_SAMPLING_KEYWORDS.some((k) => s.includes(k));
}

function resolveSwatchPath(swatchPath) {
  const base = basename(swatchPath);
  if (!SWATCH_ID_PATTERN.test(base)) return null;
  const resolved = resolve(join(SWATCH_DIR, base));
  if (!resolved.startsWith(resolve(SWATCH_DIR)) || !existsSync(resolved)) return null;
  return resolved;
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
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
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
      meta[j] = { r, g, b, labL: lab.L, labA: lab.a, labB: lab.b, sat, lum };
      lumValues.push(lum);
    }
  }

  lumValues.sort((a, b) => a - b);
  const p33 = lumValues[Math.floor(lumValues.length * 0.33)] ?? 0;
  const p66 = lumValues[Math.floor(lumValues.length * 0.66)] ?? 255;

  return { meta, p33, p66 };
}

function findBestPatchOrigin(mask, width, height, patchSize, used = null) {
  let bestScore = -Infinity;
  let bestX = 0;
  let bestY = 0;
  const maxX = Math.max(1, width - patchSize);
  const maxY = Math.max(1, height - patchSize);

  const tryWindow = (step) => {
    for (let y = 0; y < maxY; y += step) {
      for (let x = 0; x < maxX; x += step) {
        let bandHits = 0;
        let usedHits = 0;
        for (let dy = 0; dy < patchSize; dy++) {
          const row = (y + dy) * width;
          for (let dx = 0; dx < patchSize; dx++) {
            const j = row + x + dx;
            if (mask[j]) bandHits++;
            if (used?.[j]) usedHits++;
          }
        }
        const score = bandHits - usedHits * 2;
        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
  };

  tryWindow(8);
  if (bestScore < patchSize * 4) tryWindow(1);

  return { x: bestX, y: bestY, score: Math.max(0, bestScore) };
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
  const midMask = new Uint8Array(width * height);
  const hiMask = new Uint8Array(width * height);
  for (const { j } of body.slice(Math.floor(n * 0.3), Math.floor(n * 0.72))) midMask[j] = 1;
  for (const { j } of body.slice(Math.floor(n * 0.72))) hiMask[j] = 1;

  let shadowUse = shadowMask;
  const shadowCount = shadowMask.reduce((a, v) => a + v, 0);
  if (shadowCount < LIGHT_BODY_SHADOW_MIN_PIXELS) {
    shadowUse = new Uint8Array(width * height);
    for (const { j } of body.slice(0, Math.max(1, Math.floor(n * 0.25)))) shadowUse[j] = 1;
  }

  return { shadow: shadowUse, midtone: midMask, highlight: hiMask };
}

function buildTertileBandMasks(meta, width, height, p33, p66) {
  const shadow = new Uint8Array(width * height);
  const mid = new Uint8Array(width * height);
  const hi = new Uint8Array(width * height);
  for (let j = 0; j < width * height; j++) {
    const m = meta[j];
    if (!m) continue;
    if (m.lum <= p33) shadow[j] = 1;
    else if (m.lum <= p66) mid[j] = 1;
    else hi[j] = 1;
  }
  return { shadow, midtone: mid, highlight: hi };
}

function scorePatchWindow(mask, width, originX, originY, patchSize) {
  let score = 0;
  for (let dy = 0; dy < patchSize; dy++) {
    const row = (originY + dy) * width;
    for (let dx = 0; dx < patchSize; dx++) {
      if (mask[row + originX + dx]) score++;
    }
  }
  return score;
}

function centroidPatchOrigin(bandMask, width, height, patchSize, used = null) {
  let sumX = 0;
  let sumY = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (!bandMask[j] || used?.[j]) continue;
      sumX += x;
      sumY += y;
      n++;
    }
  }
  if (!n) return { x: 0, y: 0, score: 0 };
  const cx = Math.round(sumX / n);
  const cy = Math.round(sumY / n);
  const x = clamp(cx - Math.floor(patchSize / 2), 0, Math.max(0, width - patchSize));
  const y = clamp(cy - Math.floor(patchSize / 2), 0, Math.max(0, height - patchSize));
  return { x, y, score: scorePatchWindow(bandMask, width, x, y, patchSize) };
}

function markPatchUsed(used, width, originX, originY, patchSize) {
  for (let dy = 0; dy < patchSize; dy++) {
    const row = (originY + dy) * width;
    for (let dx = 0; dx < patchSize; dx++) {
      used[row + originX + dx] = 1;
    }
  }
}

/** Shadow → mid → highlight patches from distinct swatch regions. */
function extractSequentialBandPatches(data, width, height, channels, masks, patchSize) {
  const used = new Uint8Array(width * height);
  const patches = {};

  for (const name of ['shadow', 'midtone', 'highlight']) {
    const combined = new Uint8Array(width * height);
    for (let j = 0; j < width * height; j++) {
      combined[j] = masks[name][j] && !used[j];
    }
    let mask = combined;
    const count = combined.reduce((a, v) => a + v, 0);
    if (count < patchSize) mask = masks[name];

    patches[name] = extractBandPatch(data, width, height, channels, mask, patchSize, used);
    markPatchUsed(used, width, patches[name].origin.x, patches[name].origin.y, patchSize);
  }

  return patches;
}

function extractBandPatch(data, width, height, channels, bandMask, patchSize, used = null) {
  const sliding = findBestPatchOrigin(bandMask, width, height, patchSize, used);
  const centered = centroidPatchOrigin(bandMask, width, height, patchSize, used);
  const origin = centered.score >= sliding.score * 0.85 ? centered : sliding;
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

export function pickTexturePatch(texture, u) {
  const t = clamp(u, 0, 1);
  if (t < 1 / 3) return { patch: texture.patches.shadow, localU: t * 3 };
  if (t < 2 / 3) return { patch: texture.patches.midtone, localU: (t - 1 / 3) * 3 };
  return { patch: texture.patches.highlight, localU: (t - 2 / 3) * 3 };
}

export function sampleTextureLab(texture, sofaX, sofaY, u) {
  const { patch, localU } = pickTexturePatch(texture, u);
  const px = (sofaX * 1.07 + sofaY * 0.41 + Math.floor(localU * 97)) % patch.width;
  const py =
    (Math.floor(localU * (patch.height - 1)) + sofaX * 0.23 + sofaY * 0.19) % patch.height;
  const { r, g, b } = samplePatchRgb(patch, px, py);
  const lab = rgbToLab(r, g, b);
  return { lab, patchMeanL: patch.stats.meanL };
}

/**
 * Extract three real texture patches from the swatch (preserves grain / mottling).
 */
export async function getSwatchTexture(swatchPath) {
  const resolved = resolveSwatchPath(swatchPath) || resolve(swatchPath);
  if (!resolved?.startsWith(resolve(SWATCH_DIR))) {
    throw new Error(`Swatch must be under input/swatches: ${swatchPath}`);
  }

  const swatchStem = basename(resolved, extname(resolved));
  const { data, info } = await sharp(resolved).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const { meta, p33, p66 } = buildPixelMeta(data, width, height, channels);

  const masks = isLightBodySampling(swatchStem)
    ? buildLightBodyBandMasks(meta, width, height)
    : buildTertileBandMasks(meta, width, height, p33, p66);

  const patches = extractSequentialBandPatches(
    data,
    width,
    height,
    channels,
    masks,
    TEXTURE_PATCH_SIZE,
  );

  return {
    patches,
    isNamedLight: isNamedLightLeather(swatchStem),
    isLightBodySampling: isLightBodySampling(swatchStem),
    extractionMethod: isLightBodySampling(swatchStem) ? 'light-body-texture' : 'tertile-texture',
    sourceFile: basename(resolved),
    swatchSize: { width, height },
  };
}
