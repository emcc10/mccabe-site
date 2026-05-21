/**
 * Photographic color shift: original sofa L/texture preserved; swatch chroma only.
 */
import AdmZip from 'adm-zip';
import convert from 'color-convert';
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  renameSync,
  rmSync,
  unlinkSync,
  statSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { finalizeBaliExport } from './finalize-bali-export.js';
import { prepareSourceLGrain } from './leather-detail.js';
import {
  applyReferenceRealismTransfer,
  DEFAULT_REFERENCE,
  PROBE_DETAIL_MULTIPLIER,
} from './reference-realism.js';
import {
  baliRealismProbeRgb,
  PROBE_HF_GAIN,
  PROBE_L_STRUCTURE,
  PROBE_LF_GAIN,
  PROBE_MF_GAIN,
} from './realism-probe.js';
import { formatMaskedStats, maskedRgbStats } from './pipeline-trace.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const INPUT_DIR = join(ROOT, 'input');
const SWATCH_DIR = join(INPUT_DIR, 'swatches');
const OUTPUT_DIR = join(ROOT, 'output');
const PIPELINE_DEBUG_DIR = join(OUTPUT_DIR, 'pipeline-debug');
const SOFA_PATH = join(INPUT_DIR, 'sofa.png');
const MASK_PATH = join(INPUT_DIR, 'mask.png');
const BALI_REALISM_REFERENCE_PATH = join(INPUT_DIR, DEFAULT_REFERENCE);
const NEUTRAL_MASTER_PATH = join(INPUT_DIR, 'neutral-master.png');
/** @deprecated alias — same file as neutral-master.png */
const MASTER_SOFA_PATH = NEUTRAL_MASTER_PATH;
const ZIP_PATH = join(OUTPUT_DIR, 'sofa-renders.zip');
const DEFAULT_PREVIEW_SWATCH = 'Bali-Currant.jpg';

export const MASK_APPLY_THRESH = 128;
const BG_THRESH = 238;
const LAB_CHROMA_CLAMP = 72;

/** Preserve neutral-master L structure; nudge toward swatch L (LAB 0–100). */
const LIGHT_LEATHER_KEYWORDS = ['silk', 'eggshell', 'frost', 'parchment', 'vanilla', 'tusk', 'mist'];
/** Bright-body palette extraction (ignore folded shadow); not whole-swatch tertiles. */
const LIGHT_BODY_SAMPLING_KEYWORDS = ['silk', 'eggshell', 'vanilla', 'parchment'];
const LIGHT_BODY_L_EXCLUDE = 60;
const LIGHT_BODY_L_SAMPLE = 70;
const LIGHT_BODY_L_SHADOW_MAX = 72;
const LIGHT_BODY_SAT_MIN = 0.02;
const LIGHT_BODY_SAT_MAX = 0.42;
const LIGHT_BODY_WARM_B_MIN = 6;
const LIGHT_BODY_WARM_A_MIN = -2;
const LIGHT_BODY_SHADOW_MIN_PIXELS = 80;
/** Color shift: preserve original photo L; tiny swatch L hint only. */
const COLOR_SHIFT_L_ORIGINAL = 0.97;
const COLOR_SHIFT_L_SWATCH = 0.03;
/** Bali-Silk validated sample reference (light body only). */
export const BALI_SILK_TARGET_RGB = [192, 183, 168];
const BALI_BODY_MIN_PIXEL = { r: 155, g: 145, b: 130 };
const BALI_SAMPLE_FLOOR = { r: 170, g: 160, b: 145 };
const BALI_SAMPLE_RANGE = { r: [185, 215], g: [175, 205], b: [155, 190] };
const BALI_OUTPUT_FLOOR = { r: 170, g: 160, b: 145 };
const CHROMA_SWATCH = 1;

/** TEMPORARY realism stress-test — max source detail, not for production. */
export const REALISM_STRESS_HF_GAIN = 1.15;
export const REALISM_STRESS_MF_GAIN = 0.42;
export const REALISM_STRESS_L_STRUCTURE = 1;
/** Diagnostic: force uniform upholstery chroma; L from source only. */
export const BRUTE_FORCE_CHROMA_A = 2;
export const BRUTE_FORCE_CHROMA_B = 10;
/** Sofa L percentiles for shadow → mid → highlight color mapping. */
const SOFA_L_MAP_LO = 0.08;
const SOFA_L_MAP_HI = 0.92;
const SOFA_L_MAP_MIN_SPAN = 4;

const SWATCH_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SWATCH_ID_PATTERN = /^[a-z]+-[a-z]+\.(jpe?g|png|webp)$/i;
const SWATCH_BLOCK_PATTERN = /^(debug|test|chip|palette|cache|flat|target|color-)/i;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function rgbToLab(r, g, b) {
  const lab = convert.rgb.lab([r, g, b]);
  return { L: lab[0], a: lab[1], b: lab[2] };
}

export function labToRgb(L, a, b) {
  if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) {
    return { r: 0, g: 0, b: 0 };
  }
  const [r, g, bOut] = convert.lab.rgb([
    clamp(L, 0, 100),
    clamp(a, -128, 128),
    clamp(b, -128, 128),
  ]);
  return {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(bOut), 0, 255),
  };
}

function pixelBrightness(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isNearWhite(r, g, b) {
  return r > BG_THRESH && g > BG_THRESH && b > BG_THRESH;
}

export function isOriginalSwatchFile(filename) {
  const base = basename(filename);
  if (SWATCH_BLOCK_PATTERN.test(base)) return false;
  return SWATCH_ID_PATTERN.test(base);
}

export function listOriginalSwatches() {
  if (!existsSync(SWATCH_DIR)) return [];
  return readdirSync(SWATCH_DIR)
    .filter((f) => SWATCH_EXT.has(extname(f).toLowerCase()) && isOriginalSwatchFile(f))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function cleanGeneratedArtifacts(outputDir = OUTPUT_DIR) {
  if (!existsSync(outputDir)) return 0;
  let removed = 0;
  for (const f of readdirSync(outputDir)) {
    const lower = f.toLowerCase();
    if (
      lower.startsWith('debug-') ||
      lower.startsWith('test-') ||
      lower.includes('-chip') ||
      lower.includes('palette') ||
      (lower.endsWith('.json') && lower.includes('target'))
    ) {
      try {
        unlinkSync(join(outputDir, f));
        removed++;
      } catch {
        /* locked */
      }
    }
  }
  return removed;
}

export function resolveOriginalSwatchPath(filename) {
  const base = basename(filename);
  if (!isOriginalSwatchFile(base)) return null;
  const resolved = resolve(join(SWATCH_DIR, base));
  if (!resolved.startsWith(resolve(SWATCH_DIR))) return null;
  if (!existsSync(resolved)) return null;
  return resolved;
}

function medianOf(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentileOfSorted(sorted, p) {
  if (!sorted.length) return 0;
  const idx = clamp(Math.floor(sorted.length * p), 0, sorted.length - 1);
  return sorted[idx];
}

export function isBaliSilkSwatch(swatchStem) {
  return String(swatchStem).toLowerCase().includes('bali-silk');
}

export function isNamedLightLeather(swatchStem) {
  if (isBaliSilkSwatch(swatchStem)) return true;
  const s = swatchStem.toLowerCase();
  return LIGHT_LEATHER_KEYWORDS.some((k) => s.includes(k));
}

export function isLightBodySampling(swatchStem) {
  if (isBaliSilkSwatch(swatchStem)) return true;
  const s = swatchStem.toLowerCase();
  return LIGHT_BODY_SAMPLING_KEYWORDS.some((k) => s.includes(k));
}

function enrichSwatchPixel(p) {
  const lab = rgbToLab(p.r, p.g, p.b);
  return {
    ...p,
    labL: lab.L,
    labA: lab.a,
    labB: lab.b,
    sat: pixelSaturation(p.r, p.g, p.b),
  };
}

function isWarmLightBodyPixel(x) {
  return (
    x.labB >= LIGHT_BODY_WARM_B_MIN &&
    x.labA >= LIGHT_BODY_WARM_A_MIN &&
    x.sat >= LIGHT_BODY_SAT_MIN &&
    x.sat <= LIGHT_BODY_SAT_MAX
  );
}

export function pixelSaturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  return (max - min) / (max + min < 255 ? max + min : 510);
}

function medianRgbFromPixels(pixels) {
  if (!pixels.length) return [128, 128, 128];
  const rs = [];
  const gs = [];
  const bs = [];
  for (const p of pixels) {
    rs.push(p.r);
    gs.push(p.g);
    bs.push(p.b);
  }
  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);
  return [medianOf(rs), medianOf(gs), medianOf(bs)];
}

export function isBaliLightBodyPixel(r, g, b) {
  return r >= BALI_BODY_MIN_PIXEL.r && g >= BALI_BODY_MIN_PIXEL.g && b >= BALI_BODY_MIN_PIXEL.b;
}

export function validateBaliSilkSample(rgb) {
  const [r, g, b] = rgb;
  if (r < BALI_SAMPLE_FLOOR.r || g < BALI_SAMPLE_FLOOR.g || b < BALI_SAMPLE_FLOOR.b) {
    throw new Error('BAD BALI SILK SAMPLE — sampled shadow/taupe instead of light body.');
  }
  const { r: rr, g: gr, b: br } = BALI_SAMPLE_RANGE;
  if (r < rr[0] || r > rr[1] || g < gr[0] || g > gr[1] || b < br[0] || b > br[1]) {
    console.warn(
      `  warn: Bali sample RGB [${r}, ${g}, ${b}] outside approx range ${rr[0]}-${rr[1]} / ${gr[0]}-${gr[1]} / ${br[0]}-${br[1]}`,
    );
  }
}

export function isTaupeBrownRgb(r, g, b) {
  if (r < BALI_OUTPUT_FLOOR.r || g < BALI_OUTPUT_FLOOR.g || b < BALI_OUTPUT_FLOOR.b) return true;
  if (r < 180 && g < 172 && b < 158) return true;
  const lab = rgbToLab(r, g, b);
  return lab.L < 52 && lab.a > 3 && lab.b > 9;
}

export function validateBaliSilkOutput(rgb) {
  const [r, g, b] = rgb;
  if (isTaupeBrownRgb(r, g, b)) {
    throw new Error(
      `BAD BALI SILK OUTPUT — upholstery too dark/taupe (expected warm ivory): RGB [${r}, ${g}, ${b}]`,
    );
  }
}

export function deleteBaliSilkOutputs(outputDir = OUTPUT_DIR) {
  if (!existsSync(outputDir)) return;
  for (const f of readdirSync(outputDir)) {
    if (
      f.toLowerCase().includes('bali-silk') &&
      !f.includes('REALISM-STRESS') &&
      !f.includes('REALISM-PROBE')
    ) {
      try {
        unlinkSync(join(outputDir, f));
      } catch {
        /* locked */
      }
    }
  }
  const diag = join(outputDir, 'diagnostic', 'Bali-Silk');
  if (existsSync(diag)) {
    try {
      rmSync(diag, { recursive: true, force: true });
    } catch {
      /* locked */
    }
  }
}

export function renderTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function medianLabFromPixels(pixels) {
  if (!pixels.length) {
    return { L: 50, a: 0, b: 0, rgb: [128, 128, 128] };
  }
  const Ls = [];
  const as = [];
  const bs = [];
  for (const p of pixels) {
    const lab = rgbToLab(p.r, p.g, p.b);
    Ls.push(lab.L);
    as.push(lab.a);
    bs.push(lab.b);
  }
  const L = medianOf(Ls);
  const a = medianOf(as);
  const b = medianOf(bs);
  const { r, g, b: bOut } = labToRgb(L, a, b);
  return { L, a, b, rgb: [r, g, bOut] };
}

function lerpLabTone(t0, t1, t) {
  return {
    L: t0.L + (t1.L - t0.L) * t,
    a: t0.a + (t1.a - t0.a) * t,
    b: t0.b + (t1.b - t0.b) * t,
  };
}

/** Map normalized sofa luminance u∈[0,1] to shadow → mid → highlight. */
export function interpolateSwatchPalette(palette, u) {
  const t = clamp(u, 0, 1);
  const { shadow, midtone, highlight } = palette;
  if (t <= 0.5) return lerpLabTone(shadow, midtone, t * 2);
  return lerpLabTone(midtone, highlight, (t - 0.5) * 2);
}

async function loadSwatchPixels(swatchPath) {
  const resolved = resolveOriginalSwatchPath(swatchPath) || resolve(swatchPath);
  if (!resolved.startsWith(resolve(SWATCH_DIR))) {
    throw new Error(`Swatch must be under input/swatches: ${swatchPath}`);
  }

  const { data, info } = await sharp(resolved).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = info.channels === 4 ? data[i + 3] : 255;
      if (alpha < 20 || isNearWhite(r, g, b)) continue;
      pixels.push({ r, g, b, lum: pixelBrightness(r, g, b) });
    }
  }

  if (pixels.length < 9) {
    throw new Error(`Not enough swatch pixels: ${resolved}`);
  }

  return { resolved, pixels };
}

/** Whole swatch luminance tertiles (dark/mid leathers). */
function extractFullSwatchTertilePalette(rawPixels) {
  const sorted = [...rawPixels].sort((a, b) => a.lum - b.lum);
  const third = Math.floor(sorted.length / 3);
  const shadowPx = sorted.slice(0, third);
  const midPx = sorted.slice(third, third * 2);
  const hiPx = sorted.slice(third * 2);
  return {
    shadow: medianLabFromPixels(shadowPx),
    midtone: medianLabFromPixels(midPx),
    highlight: medianLabFromPixels(hiPx),
    extractionMethod: 'full-tertile',
    bandCounts: { shadow: shadowPx.length, mid: midPx.length, highlight: hiPx.length },
  };
}

/**
 * Light leathers: sample bright body only (L>70), warm beige; shadow from L 60–72 band.
 * Ignores folded diagonal shadows and gray-brown folds (L<60).
 */
function extractLightBodyPalette(rawPixels) {
  const all = rawPixels.map(enrichSwatchPixel);
  const warm = (x) => isWarmLightBodyPixel(x);

  const body = all.filter((x) => x.labL > LIGHT_BODY_L_SAMPLE && warm(x));
  if (body.length < 48) {
    throw new Error(
      `Not enough bright-body pixels (${body.length}); need L>${LIGHT_BODY_L_SAMPLE} warm beige`,
    );
  }

  body.sort((a, b) => a.labL - b.labL);
  const n = body.length;

  const shadowBand = all.filter(
    (x) => x.labL >= LIGHT_BODY_L_EXCLUDE && x.labL < LIGHT_BODY_L_SHADOW_MAX && warm(x),
  );
  const shadowPx =
    shadowBand.length >= LIGHT_BODY_SHADOW_MIN_PIXELS
      ? shadowBand
      : body.slice(0, Math.max(1, Math.floor(n * 0.25)));

  const midPx = body.slice(Math.floor(n * 0.35), Math.floor(n * 0.65));
  const hiPx = body.slice(Math.floor(n * 0.88));

  return {
    shadow: medianLabFromPixels(shadowPx),
    midtone: medianLabFromPixels(midPx),
    highlight: medianLabFromPixels(hiPx),
    extractionMethod: 'light-body',
    bandCounts: {
      shadow: shadowPx.length,
      mid: midPx.length,
      highlight: hiPx.length,
      body: n,
    },
  };
}

/** Mean RGB of non-background swatch pixels. */
export function computeSwatchRgbAvg(data, width, height, channels) {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = channels === 4 ? data[i + 3] : 255;
      if (alpha < 20 || isNearWhite(r, g, b)) continue;
      sum += r + g + b;
      n++;
    }
  }
  return n ? sum / (3 * n) : 0;
}

function labToneFromRgb(rgb) {
  const [r, g, b] = rgb;
  const lab = rgbToLab(r, g, b);
  return { L: lab.L, a: lab.a, b: lab.b, rgb: [r, g, b] };
}

/**
 * Bali-Silk: actual swatch image, light body only (no fold/shadow/dark pixels).
 */
export function extractBaliSilkValidatedPalette(rawPixels) {
  const body = rawPixels.filter((p) => isBaliLightBodyPixel(p.r, p.g, p.b));
  if (body.length < 48) {
    throw new Error(
      `BAD BALI SILK SAMPLE — only ${body.length} light-body pixels (need r>=${BALI_BODY_MIN_PIXEL.r} g>=${BALI_BODY_MIN_PIXEL.g} b>=${BALI_BODY_MIN_PIXEL.b})`,
    );
  }

  body.sort((a, b) => a.lum - b.lum);
  const brightStart = Math.floor(body.length * 0.4);
  const bright = body.slice(brightStart);
  const sampleRgb = medianRgbFromPixels(bright);
  validateBaliSilkSample(sampleRgb);

  const third = Math.max(1, Math.floor(bright.length / 3));
  const shadowPx = bright.slice(0, third);
  const midPx = bright.slice(third, third * 2);
  const hiPx = bright.slice(third * 2);

  return {
    shadow: medianLabFromPixels(shadowPx),
    midtone: medianLabFromPixels(midPx),
    highlight: medianLabFromPixels(hiPx),
    extractionMethod: 'bali-validated-light-body',
    bandCounts: {
      body: body.length,
      bright: bright.length,
      sampleRgb: sampleRgb.join(','),
    },
    validatedSampleRgb: sampleRgb,
  };
}

/**
 * Shadow / mid / highlight from luminance tertiles (per-band median LAB, not one flat color).
 */
export async function getSwatchPalette(swatchPath) {
  const resolved = resolveOriginalSwatchPath(swatchPath) || resolve(swatchPath);
  const swatchStem = basename(resolved, extname(resolved));

  if (isBaliSilkSwatch(swatchStem)) {
    const { resolved: swPath, pixels } = await loadSwatchPixels(swatchPath);
    const tones = extractBaliSilkValidatedPalette(pixels);
    return {
      shadow: tones.shadow,
      midtone: tones.midtone,
      highlight: tones.highlight,
      isBaliSilk: true,
      isNamedLight: true,
      isLightBodySampling: true,
      extractionMethod: tones.extractionMethod,
      pixelCount: pixels.length,
      sourceFile: basename(swPath),
      bandCounts: tones.bandCounts,
      validatedSampleRgb: tones.validatedSampleRgb,
    };
  }

  const { resolved: swPath, pixels } = await loadSwatchPixels(swatchPath);
  const useLightBody = isLightBodySampling(swatchStem);
  const tones = useLightBody
    ? extractLightBodyPalette(pixels)
    : extractFullSwatchTertilePalette(pixels);

  return {
    shadow: tones.shadow,
    midtone: tones.midtone,
    highlight: tones.highlight,
    isBaliSilk: false,
    isNamedLight: isNamedLightLeather(swatchStem),
    isLightBodySampling: useLightBody,
    extractionMethod: tones.extractionMethod,
    pixelCount: pixels.length,
    sourceFile: basename(swPath),
    bandCounts: tones.bandCounts,
  };
}

/** @deprecated Use getSwatchPalette; returns midtone fields for legacy callers. */
export async function getSwatchMedianLab(swatchPath) {
  const palette = await getSwatchPalette(swatchPath);
  const m = palette.midtone;
  return {
    meanL: m.L,
    meanA: m.a,
    meanB: m.b,
    swatchLumRgb: pixelBrightness(m.rgb[0], m.rgb[1], m.rgb[2]),
    isNamedLight: palette.isNamedLight,
    overallRGB: m.rgb,
    pixelCount: palette.pixelCount,
    sourceFile: palette.sourceFile,
    palette,
  };
}

/** @deprecated alias */
export async function getSwatchLabStats(swatchPath) {
  const s = await getSwatchMedianLab(swatchPath);
  return {
    stats: {
      meanL: s.meanL,
      meanA: s.meanA,
      meanB: s.meanB,
      isLightSwatch: s.isNamedLight,
      isNamedLight: s.isNamedLight,
    },
    overallRGB: s.overallRGB,
    pixelCount: s.pixelCount,
    sourceFile: s.sourceFile,
  };
}

/**
 * True neutral master: source LAB L preserved; upholstery a=b=0 (no cognac chroma in base).
 */
export function buildNeutralGrayMaster(sourceImage, mask) {
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.from(data);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    const { L } = rgbToLab(data[p], data[p + 1], data[p + 2]);
    const { r, g, b } = labToRgb(L, 0, 0);
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
    if (channels === 4) out[p + 3] = data[p + 3];
  }

  return { data: out, width, height, channels };
}

/** Mean LAB on masked upholstery (verify neutral master has a,b ≈ 0). */
export function meanMaskedLab(image, mask) {
  const { data, width, height, channels } = image;
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let n = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
    n++;
  }
  return n
    ? { n, L: sumL / n, a: sumA / n, b: sumB / n }
    : { n: 0, L: 0, a: 0, b: 0 };
}

/** Mean RGB on masked upholstery pixels. */
export function meanMaskedRgb(image, mask) {
  const { data, width, height, channels } = image;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    sr += data[p];
    sg += data[p + 1];
    sb += data[p + 2];
    n++;
  }
  return n
    ? [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)]
    : [0, 0, 0];
}

export async function loadImage(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

export async function saveImage(data, path, width, height, channels = 4) {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = join(
    tmpdir(),
    `sofa-recolor-${Date.now()}-${basename(path).replace(/[^\w.-]/g, '_')}`,
  );
  await sharp(data, { raw: { width, height, channels } }).png().toFile(tmpPath);
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* locked */
  }
  try {
    renameSync(tmpPath, path);
  } catch {
    await sharp(tmpPath).toFile(path);
    try {
      unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
  if (!existsSync(path)) throw new Error(`PNG not created: ${path}`);
  const { size } = statSync(path);
  if (size < 10_000) throw new Error(`PNG too small (${size} bytes): ${path}`);
  return size;
}

/** Load manually cleaned upholstery mask (luminance > 127 = upholstery). */
export async function loadUpholsteryMask(maskPath, width, height) {
  const m = await loadImage(maskPath);
  if (m.width !== width || m.height !== height) {
    throw new Error(`mask.png must be ${width}x${height}, got ${m.width}x${m.height}`);
  }
  const mask = new Uint8Array(width * height);
  for (let j = 0, i = 0; j < width * height; j++, i += m.channels) {
    const lum = pixelBrightness(m.data[i], m.data[i + 1], m.data[i + 2]);
    mask[j] = lum > 127 ? 255 : 0;
  }
  return mask;
}

/** Masked sofa L percentiles for palette color placement. */
export function computeSofaLuminanceMapRange(masterImage, mask) {
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

/** Bali L: source photo L + brightness offset (preserves all ΔL from catalog photo). */
export function baliPreservedPhotoL(photoL, meanPhotoL, anchorL) {
  return clamp(photoL + (anchorL - meanPhotoL), 0, 100);
}

function meanMaskedRec709Luma(image, mask) {
  const { data, width, height, channels } = image;
  let sum = 0;
  let n = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    sum += pixelBrightness(data[p], data[p + 1], data[p + 2]);
    n++;
  }
  return n ? sum / n : 0;
}

/**
 * Swatch chroma in LAB, then restore each pixel's original Rec.709 luma (catalog microcontrast).
 */
function computeBaliFullLRange(sourceImage, mask) {
  const { data, width, height, channels } = sourceImage;
  let lo = 100;
  let hi = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    const L = rgbToLab(data[p], data[p + 1], data[p + 2]).L;
    if (L < lo) lo = L;
    if (L > hi) hi = L;
  }
  return { lo, hi, span: Math.max(hi - lo, 4) };
}

/** TEMPORARY: extreme source L/HF/MF preservation for pipeline debug. */
export function baliRealismStressRgb(
  r,
  g,
  b,
  chroma,
  grain,
  j,
  photoL,
  meanPhotoL,
  anchorL,
  lumOffset,
) {
  let finalL = photoL + (anchorL - meanPhotoL) * REALISM_STRESS_L_STRUCTURE;
  finalL += grain.sourceHf[j] * REALISM_STRESS_HF_GAIN + grain.sourceMf[j] * REALISM_STRESS_MF_GAIN;
  finalL = clamp(finalL, 0, 100);
  const { r: tr, g: tg, b: tb } = labToRgb(finalL, chroma.a, chroma.b);
  const srcLum = pixelBrightness(r, g, b);
  const outLum = pixelBrightness(tr, tg, tb);
  const ratio = (srcLum + lumOffset) / Math.max(outLum, 0.25);
  return {
    r: clamp(Math.round(tr * ratio), 0, 255),
    g: clamp(Math.round(tg * ratio), 0, 255),
    b: clamp(Math.round(tb * ratio), 0, 255),
  };
}

/**
 * Production Bali: swatch a/b only; source LAB L + uniform tone offset (ΔL preserved).
 * Per-pixel Rec.709 luma restored — catalog microcontrast, no post-enhancement.
 */
export function baliChromaOnlyPreserveSourceLuma(
  r,
  g,
  b,
  chroma,
  photoL,
  meanPhotoL,
  anchorL,
  lumOffset,
) {
  const srcLum = pixelBrightness(r, g, b);
  const finalL = photoL + (anchorL - meanPhotoL);
  const { r: tr, g: tg, b: tb } = labToRgb(clamp(finalL, 0, 100), chroma.a, chroma.b);
  const outLum = pixelBrightness(tr, tg, tb);
  const targetLum = srcLum + lumOffset;
  const ratio = targetLum / Math.max(outLum, 0.5);
  return {
    r: clamp(Math.round(tr * ratio), 0, 255),
    g: clamp(Math.round(tg * ratio), 0, 255),
    b: clamp(Math.round(tb * ratio), 0, 255),
  };
}

/** @deprecated alias */
export function baliRgbPreserveSourceLuma(r, g, b, chroma, photoL, meanPhotoL, anchorL, lumOffset) {
  return baliChromaOnlyPreserveSourceLuma(r, g, b, chroma, photoL, meanPhotoL, anchorL, lumOffset);
}

export function computeFinalLabL(originalL, swatchL) {
  return originalL * COLOR_SHIFT_L_ORIGINAL + swatchL * COLOR_SHIFT_L_SWATCH;
}

/** L from photo only — original a/b are discarded, not blended. */
export function photoLuminanceOnly(r, g, b) {
  return rgbToLab(r, g, b).L;
}

/** Swatch a/b only — zero cognac chroma. */
export function swatchChromaForPixel(palette, u) {
  const tone = interpolateSwatchPalette(palette, u);
  return { a: tone.a * CHROMA_SWATCH, b: tone.b * CHROMA_SWATCH, L: tone.L };
}

/**
 * Photographic recolor: original buffer + mask pixels get swatch chroma and preserved photo L.
 * No post-recolor compositing, enhancement, or cleanup.
 */
export function recolorSofa(sourceImage, mask, palette, options = {}) {
  const realismStress = Boolean(options.realismStress && palette.isBaliSilk);
  const realismProbe = Boolean(options.realismProbe && palette.isBaliSilk);
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.from(data);
  const lMap = palette.isBaliSilk
    ? computeBaliFullLRange(sourceImage, mask)
    : computeSofaLuminanceMapRange(sourceImage, mask);
  const lo = lMap.lo;
  const span = lMap.span;
  const meanPhotoL = palette.isBaliSilk ? meanMaskedLab(sourceImage, mask).L : 0;
  const anchorL = palette.isBaliSilk ? palette.midtone.L : 0;
  const meanSrcLum = palette.isBaliSilk ? meanMaskedRec709Luma(sourceImage, mask) : 0;
  const midRgb = palette.isBaliSilk
    ? labToRgb(anchorL, palette.midtone.a, palette.midtone.b)
    : { r: 0, g: 0, b: 0 };
  const lumOffset = palette.isBaliSilk
    ? pixelBrightness(midRgb.r, midRgb.g, midRgb.b) - meanSrcLum
    : 0;
  const grain = realismStress || realismProbe ? prepareSourceLGrain(sourceImage) : null;

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;

    const p = j * channels;
    const r = data[p];
    const g = data[p + 1];
    const bIn = data[p + 2];
    const photoL = photoLuminanceOnly(r, g, bIn);
    const u = clamp((photoL - lo) / span, 0, 1);
    const chroma = swatchChromaForPixel(palette, u);

    if (palette.isBaliSilk && realismProbe) {
      const rgb = baliRealismProbeRgb(
        r,
        g,
        bIn,
        chroma,
        grain,
        j,
        photoL,
        meanPhotoL,
        anchorL,
      );
      out[p] = rgb.r;
      out[p + 1] = rgb.g;
      out[p + 2] = rgb.b;
    } else if (palette.isBaliSilk && realismStress) {
      const rgb = baliRealismStressRgb(
        r,
        g,
        bIn,
        chroma,
        grain,
        j,
        photoL,
        meanPhotoL,
        anchorL,
        lumOffset,
      );
      out[p] = rgb.r;
      out[p + 1] = rgb.g;
      out[p + 2] = rgb.b;
    } else if (palette.isBaliSilk) {
      const rgb = baliChromaOnlyPreserveSourceLuma(
        r,
        g,
        bIn,
        chroma,
        photoL,
        meanPhotoL,
        anchorL,
        lumOffset,
      );
      out[p] = rgb.r;
      out[p + 1] = rgb.g;
      out[p + 2] = rgb.b;
    } else {
      const finalL = clamp(computeFinalLabL(photoL, chroma.L), 0, 100);
      const finalA = clamp(chroma.a, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
      const finalB = clamp(chroma.b, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
      const { r: outR, g: outG, b: bOut } = labToRgb(finalL, finalA, finalB);
      out[p] = outR;
      out[p + 1] = outG;
      out[p + 2] = bOut;
    }
    if (channels === 4) out[p + 3] = data[p + 3];
  }

  if (palette.isBaliSilk && !options.skipFinalize) {
    finalizeBaliExport(out, sourceImage, mask);
  }

  return out;
}

/** Photorealistic Bali donor (stress render or hand-picked reference). */
export function resolveBaliRealismReferencePath(outputDir = OUTPUT_DIR) {
  if (existsSync(BALI_REALISM_REFERENCE_PATH)) return BALI_REALISM_REFERENCE_PATH;
  if (!existsSync(outputDir)) return null;
  const stress = readdirSync(outputDir)
    .filter((f) => f.includes('REALISM-STRESS') && f.toLowerCase().endsWith('.png'))
    .sort()
    .reverse();
  return stress.length ? join(outputDir, stress[0]) : null;
}

/**
 * TEMPORARY: exaggerated probe + pipeline trace (proves export path + finds flattening).
 */
export async function processBaliRealismProbe(sourceImage, mask, palette) {
  const { width, height, channels } = sourceImage;
  const ts = renderTimestamp();
  const traceDir = join(PIPELINE_DEBUG_DIR, ts);
  mkdirSync(traceDir, { recursive: true });

  console.log('\n  === REALISM PROBE (exaggerated source detail, no flattening) ===');
  console.log(
    `  probe gains: L×${PROBE_L_STRUCTURE} HF×${PROBE_HF_GAIN} MF×${PROBE_MF_GAIN} LF×${PROBE_LF_GAIN} | no luma lock | no ref transfer on export`,
  );

  const flatData = recolorSofa(sourceImage, mask, palette, { skipFinalize: true });
  const probeData = recolorSofa(sourceImage, mask, palette, {
    realismProbe: true,
    skipFinalize: true,
  });

  const flatImg = { data: flatData, width, height, channels };
  const probeImg = { data: probeData, width, height, channels };

  await saveImage(flatData, join(traceDir, 'A-production-recolor-no-ref.png'), width, height, channels);
  await saveImage(probeData, join(traceDir, 'B-probe-recolor-pre-finalize.png'), width, height, channels);

  const sFlatProbe = maskedRgbStats(flatData, probeData, mask, width, height, channels);
  console.log(formatMaskedStats('masked Δ: production recolor vs PROBE recolor (MUST be large)', sFlatProbe));

  const refPath = resolveBaliRealismReferencePath();
  if (refPath) {
    const refImg = await loadImage(refPath);
    const afterRefLocked = Buffer.from(flatData);
    applyReferenceRealismTransfer(
      afterRefLocked,
      flatImg,
      refImg,
      mask,
    );
    const sRefLocked = maskedRgbStats(flatData, afterRefLocked, mask, width, height, channels);
    console.log(
      formatMaskedStats(
        'masked Δ: production recolor vs ref-transfer WITH luma lock (often ~0 = cancelled)',
        sRefLocked,
      ),
    );

    const afterRefOpen = Buffer.from(flatData);
    applyReferenceRealismTransfer(afterRefOpen, flatImg, refImg, mask, {
      skipLumaLock: true,
      skipMeanNormalize: true,
      detailMultiplier: PROBE_DETAIL_MULTIPLIER,
      skipLocalContrast: true,
    });
    const sRefOpen = maskedRgbStats(flatData, afterRefOpen, mask, width, height, channels);
    console.log(
      formatMaskedStats(
        'masked Δ: production recolor vs ref-transfer NO luma lock (detail visible)',
        sRefOpen,
      ),
    );
    await saveImage(
      afterRefOpen,
      join(traceDir, 'C-ref-transfer-no-luma-lock.png'),
      width,
      height,
      channels,
    );
  }

  const finalData = Buffer.from(probeData);
  finalizeBaliExport(finalData, sourceImage, mask);
  const sProbeFinal = maskedRgbStats(probeData, finalData, mask, width, height, channels);
  console.log(
    formatMaskedStats(
      'masked Δ: PROBE recolor vs final export (upholstery should be ~0; bg may differ)',
      sProbeFinal,
    ),
  );

  await saveImage(
    finalData,
    join(traceDir, 'D-probe-final-export.png'),
    width,
    height,
    channels,
  );

  const outPath = join(OUTPUT_DIR, `Bali-Silk-REALISM-PROBE-${ts}.png`);
  const bytes = await saveImage(finalData, outPath, width, height, channels);
  console.log(`\n  OPEN PROBE EXPORT (must look visibly grittier than production):`);
  console.log(`    ${resolve(outPath)} (${Math.round(bytes / 1024)} KB)`);
  console.log(`  pipeline trace folder:`);
  console.log(`    ${resolve(traceDir)}`);

  if (sFlatProbe.rms < 2.5) {
    console.warn(
      '  WARN: probe recolor ≈ production recolor on mask — probe branch may not be active.',
    );
  }
  return { outPath, traceDir };
}

/**
 * Diagnostic: fixed LAB chroma on all upholstery; original source L only.
 * No swatch extraction, cognac blend, palette, or Bali fine-tune.
 */
export function recolorSofaBruteForceChroma(
  sourceImage,
  mask,
  fixedA = BRUTE_FORCE_CHROMA_A,
  fixedB = BRUTE_FORCE_CHROMA_B,
) {
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.from(data);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;

    const p = j * channels;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    const finalL = clamp(lab.L, 0, 100);
    const { r, g, b: bOut } = labToRgb(finalL, fixedA, fixedB);

    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = bOut;
    if (channels === 4) out[p + 3] = data[p + 3];
  }

  return out;
}

export async function processBruteChromaDiagnostic(sourceImage, mask, label = 'Bali-Silk') {
  const ref = labToRgb(50, BRUTE_FORCE_CHROMA_A, BRUTE_FORCE_CHROMA_B);
  console.log('\n  BRUTE-FORCE CHROMA DIAGNOSTIC');
  console.log(`  forced LAB: a=${BRUTE_FORCE_CHROMA_A} b=${BRUTE_FORCE_CHROMA_B}`);
  console.log(`  L: original source per pixel (no swatch, no cognac a/b)`);
  console.log(`  reference RGB at L=50: [${ref.r}, ${ref.g}, ${ref.b}] (target ~228,221,206)`);

  const outData = recolorSofaBruteForceChroma(sourceImage, mask);
  const outPath = join(OUTPUT_DIR, `${label}-BRUTE-CHROMA.png`);
  const bytes = await saveImage(
    outData,
    outPath,
    sourceImage.width,
    sourceImage.height,
    sourceImage.channels,
  );
  console.log(`  wrote ${basename(outPath)} (${Math.round(bytes / 1024)} KB)`);

  const diagDir = join(OUTPUT_DIR, 'diagnostic', label);
  mkdirSync(diagDir, { recursive: true });
  const diagPath = join(diagDir, 'brute-force-chroma.png');
  copyFileSync(outPath, diagPath);
  console.log('\n  OPEN THIS BRUTE-FORCE TEST:');
  console.log(`    ${resolve(outPath)}`);
  console.log(`    ${resolve(diagPath)}`);
  return { outPath };
}

/** Mirror render to diagnostic folder + legacy -fixed name; log absolute paths. */
export function publishRenderOutputs(swatchName, primaryPngPath) {
  const diagDir = join(OUTPUT_DIR, 'diagnostic', swatchName);
  mkdirSync(diagDir, { recursive: true });
  const copies = [
    join(diagDir, 'final-output.png'),
    join(OUTPUT_DIR, `${swatchName}-fixed.png`),
  ];
  for (const dest of copies) {
    copyFileSync(primaryPngPath, dest);
  }
  const abs = resolve(primaryPngPath);
  console.log('\n  OPEN THIS RENDER (full path):');
  console.log(`    ${abs}`);
  console.log(`    ${resolve(copies[0])}`);
  console.log(`    ${resolve(copies[1])}`);
  console.log('  (Ignore *-texture.png in diagnostic — those are old debug files.)');
  return { primary: abs, diagnostic: resolve(copies[0]), legacyFixed: resolve(copies[1]) };
}

export async function processSwatch(swatchPath, sourceImage, mask, options = {}) {
  const realismStress = Boolean(options.realismStress);
  const realismProbe = Boolean(options.realismProbe);
  const resolved = resolveOriginalSwatchPath(swatchPath);
  if (!resolved) throw new Error(`Not an original swatch: ${swatchPath}`);

  const swatchName = basename(resolved, extname(resolved));
  const isBali = isBaliSilkSwatch(swatchName);

  if (isBali && !realismProbe) {
    deleteBaliSilkOutputs();
    console.log('  cleared previous Bali-Silk outputs');
  }

  const palette = await getSwatchPalette(resolved);

  if (isBali && realismProbe) {
    return processBaliRealismProbe(sourceImage, mask, palette);
  }

  const fmtTone = (t) => ({
    rgb: t.rgb,
    lab: [Math.round(t.L * 10) / 10, Math.round(t.a * 10) / 10, Math.round(t.b * 10) / 10],
  });

  console.log({
    swatchName,
    source: `input/swatches/${palette.sourceFile}`,
    extraction: palette.extractionMethod,
    validatedSampleRgb: palette.validatedSampleRgb || null,
    shadow: fmtTone(palette.shadow),
    midtone: fmtTone(palette.midtone),
    highlight: fmtTone(palette.highlight),
    lightLeather: palette.isNamedLight,
    lBlend: isBali
      ? realismStress
        ? `STRESS: L×${REALISM_STRESS_L_STRUCTURE} HF×${REALISM_STRESS_HF_GAIN} MF×${REALISM_STRESS_MF_GAIN} full L-range u`
        : 'source ΔL + swatch a/b; per-pixel source Rec.709 luma (chroma only, no post)'
      : `original L ${COLOR_SHIFT_L_ORIGINAL * 100}% / swatch ${COLOR_SHIFT_L_SWATCH * 100}%`,
    chroma: 'swatch a/b 100% (0% cognac)',
    postProcess: isBali
      ? realismStress
        ? 'finalize bg/bottom only (no upholstery touch)'
        : 'finalize bg/bottom only — no reference, no upholstery post'
      : null,
  });

  const outData = recolorSofa(sourceImage, mask, palette, {
    realismStress,
    skipFinalize: isBali,
  });

  if (isBali) {
    finalizeBaliExport(outData, sourceImage, mask);
  }

  const outImage = {
    data: outData,
    width: sourceImage.width,
    height: sourceImage.height,
    channels: sourceImage.channels,
  };

  if (isBali) {
    const meanRgb = meanMaskedRgb(outImage, mask);
    const meanLab = meanMaskedLab(outImage, mask);
    console.log(
      `  upholstery mean: RGB [${meanRgb[0]}, ${meanRgb[1]}, ${meanRgb[2]}]  LAB L=${meanLab.L.toFixed(1)} a=${meanLab.a.toFixed(1)} b=${meanLab.b.toFixed(1)}`,
    );
    if (realismStress) {
      console.log('  (stress-test: color validation skipped — compare detail vs production render)');
    } else {
      validateBaliSilkOutput(meanRgb);
      console.log('  output validation: PASS (warm ivory range)');
    }
  }

  const outPath = isBali
    ? realismStress
      ? join(OUTPUT_DIR, `Bali-Silk-REALISM-STRESS-${renderTimestamp()}.png`)
      : join(OUTPUT_DIR, `Bali-Silk-${renderTimestamp()}.png`)
    : join(OUTPUT_DIR, `${swatchName}.png`);
  const bytes = await saveImage(
    outData,
    outPath,
    sourceImage.width,
    sourceImage.height,
    sourceImage.channels,
  );
  console.log(`\n  wrote ${basename(outPath)} (${Math.round(bytes / 1024)} KB)`);
  console.log(`  ${resolve(outPath)}`);
  if (!isBali) publishRenderOutputs(swatchName, outPath);
  return { outPath, palette };
}

export function zipOutputs(outputDir, zipPath) {
  const zip = new AdmZip();
  const files = readdirSync(outputDir).filter(
    (f) =>
      f.toLowerCase().endsWith('.png') &&
      f !== 'sofa-renders.zip' &&
      !f.startsWith('DEBUG-') &&
      !f.startsWith('TEST-'),
  );
  if (!files.length) throw new Error(`No PNG files in ${outputDir}`);
  for (const f of files) zip.addLocalFile(join(outputDir, f), '', f);
  mkdirSync(dirname(zipPath), { recursive: true });
  zip.writeZip(zipPath);
  return files.length;
}

function resolveSwatchArg(name) {
  if (!name) return null;
  const direct = resolveOriginalSwatchPath(basename(name));
  if (direct) return direct;
  const stem = basename(name, extname(name));
  const hit = listOriginalSwatches().find(
    (f) => basename(f, extname(f)).toLowerCase() === stem.toLowerCase(),
  );
  return hit ? resolveOriginalSwatchPath(hit) : null;
}

function parseCli(argv) {
  const args = argv.slice(2);
  let all = false;
  let bruteChroma = false;
  let realismStress = false;
  let realismProbe = false;
  let swatchFile = null;
  for (const a of args) {
    if (a === '--all') all = true;
    else if (a === '--brute-chroma') bruteChroma = true;
    else if (a === '--realism-stress') realismStress = true;
    else if (a === '--realism-probe') realismProbe = true;
    else if (a === '--currant' || a === '--current') swatchFile = DEFAULT_PREVIEW_SWATCH;
    else if (a.startsWith('--swatch=')) swatchFile = a.slice('--swatch='.length);
    else if (!a.startsWith('-')) swatchFile = a;
  }
  if (bruteChroma) return { mode: 'brute-chroma', swatchFile: swatchFile || 'Bali-Silk' };
  if (realismProbe) return { mode: 'realism-probe', swatchFile: swatchFile || 'Bali-Silk' };
  if (realismStress) return { mode: 'realism-stress', swatchFile: swatchFile || 'Bali-Silk' };
  if (all) return { mode: 'all' };
  return { mode: 'one', swatchFile: swatchFile || DEFAULT_PREVIEW_SWATCH };
}

export async function main(argv = process.argv) {
  if (!existsSync(SOFA_PATH) || !existsSync(SWATCH_DIR)) {
    console.error('Missing input/sofa.png or input/swatches/');
    process.exit(1);
  }
  if (!existsSync(MASK_PATH)) {
    console.error('Missing input/mask.png — manually cleaned upholstery mask is required.');
    process.exit(1);
  }

  const cli = parseCli(argv);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  cleanGeneratedArtifacts();

  const swatchFiles = listOriginalSwatches();
  if (!swatchFiles.length) {
    console.error(`No leather swatches in ${SWATCH_DIR}`);
    process.exit(1);
  }

  console.log(`  swatch source: ${SWATCH_DIR} (${swatchFiles.length} files)`);
  console.log(`  source photo: ${SOFA_PATH}`);
  console.log(`  mask: ${MASK_PATH}`);
  const sourceSofa = await loadImage(SOFA_PATH);
  console.log(`  ${sourceSofa.width}x${sourceSofa.height}`);

  const mask = await loadUpholsteryMask(MASK_PATH, sourceSofa.width, sourceSofa.height);

  if (cli.mode === 'brute-chroma') {
    const label = basename(cli.swatchFile, extname(cli.swatchFile));
    console.log('  method: BRUTE-FORCE fixed chroma diagnostic (not production pipeline)');
    const { outPath } = await processBruteChromaDiagnostic(sourceSofa, mask, label);
    console.log(`\nDone: ${outPath}`);
    return;
  }

  if (cli.mode === 'realism-probe') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    console.log('  method: REALISM PROBE — exaggerated source detail + pipeline trace');
    const { outPath } = await processSwatch(swPath, sourceSofa, mask, { realismProbe: true });
    console.log(`\nDone: ${outPath}`);
    return;
  }

  if (cli.mode === 'realism-stress') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    console.log('  method: REALISM STRESS TEST — max source photo detail (debug only)');
    const { outPath } = await processSwatch(swPath, sourceSofa, mask, { realismStress: true });
    console.log(`\nDone: ${outPath}`);
    console.log('  Compare side-by-side with latest Bali-Silk-*.png production render.');
    return;
  }

  console.log(
    '  method: Bali chroma only + 100% source luminance; finalize bg/bottom only (no upholstery post)',
  );

  if (cli.mode === 'one') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    const { outPath } = await processSwatch(swPath, sourceSofa, mask);
    console.log(`\nDone: ${outPath}`);
    return;
  }

  for (const file of swatchFiles) {
    await processSwatch(join(SWATCH_DIR, file), sourceSofa, mask);
  }

  const onDisk = readdirSync(OUTPUT_DIR).filter(
    (f) => f.endsWith('.png') && isOriginalSwatchFile(f.replace(/\.png$/i, '.jpg')),
  );
  console.log(`\nSofa PNGs: ${onDisk.length} / ${swatchFiles.length}`);

  try {
    zipOutputs(OUTPUT_DIR, ZIP_PATH);
    console.log(`Zip: ${ZIP_PATH}`);
  } catch (err) {
    console.warn(`Zip skipped: ${err.message}`);
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
