/**
 * Color transfer: neutral-gray master (sofa L/texture) + swatch palette (chroma only).
 * No swatch texture tiling or UV mapping.
 */
import AdmZip from 'adm-zip';
import convert from 'color-convert';
import {
  mkdirSync,
  readdirSync,
  existsSync,
  renameSync,
  unlinkSync,
  statSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const INPUT_DIR = join(ROOT, 'input');
const SWATCH_DIR = join(INPUT_DIR, 'swatches');
const OUTPUT_DIR = join(ROOT, 'output');
const SOFA_PATH = join(INPUT_DIR, 'sofa.png');
const MASK_PATH = join(INPUT_DIR, 'mask.png');
const MASTER_SOFA_PATH = join(INPUT_DIR, 'master-sofa.png');
const ZIP_PATH = join(OUTPUT_DIR, 'sofa-renders.zip');
const DEFAULT_PREVIEW_SWATCH = 'Bali-Currant.jpg';

const MASK_APPLY_THRESH = 128;
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
const L_BLEND_MASTER = 0.52;
const L_BLEND_SWATCH = 0.48;
const LIGHT_SHADOW_ANCHOR = 58;
const LIGHT_SHADOW_COMPRESS = 0.78;
const LIGHT_L_LIFT = 10;
const LIGHT_L_MAX = 96;
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

function isNearWhite(r, g, b) {
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

/**
 * Shadow / mid / highlight from luminance tertiles (per-band median LAB, not one flat color).
 */
export async function getSwatchPalette(swatchPath) {
  const { resolved, pixels } = await loadSwatchPixels(swatchPath);
  const swatchStem = basename(resolved, extname(resolved));
  const useLightBody = isLightBodySampling(swatchStem);
  const tones = useLightBody
    ? extractLightBodyPalette(pixels)
    : extractFullSwatchTertilePalette(pixels);

  return {
    shadow: tones.shadow,
    midtone: tones.midtone,
    highlight: tones.highlight,
    isBaliSilk: isBaliSilkSwatch(swatchStem),
    isNamedLight: isNamedLightLeather(swatchStem),
    isLightBodySampling: useLightBody,
    extractionMethod: tones.extractionMethod,
    pixelCount: pixels.length,
    sourceFile: basename(resolved),
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
 * Neutral-gray master: same luminance as source, zero chroma (photographic detail preserved).
 */
export function buildNeutralGrayMaster(sourceImage, mask) {
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.from(data);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    const lum = Math.round(pixelBrightness(data[p], data[p + 1], data[p + 2]));
    out[p] = lum;
    out[p + 1] = lum;
    out[p + 2] = lum;
  }

  return { data: out, width, height, channels };
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

/** Sofa L + swatch L; light neutrals compress shadows then +10 LAB (max 96). */
export function computeFinalLabL(masterL, swatchL, isVeryLightLeather) {
  let finalL = masterL * L_BLEND_MASTER + swatchL * L_BLEND_SWATCH;
  if (isVeryLightLeather) {
    if (finalL < LIGHT_SHADOW_ANCHOR) {
      finalL = LIGHT_SHADOW_ANCHOR + (finalL - LIGHT_SHADOW_ANCHOR) * LIGHT_SHADOW_COMPRESS;
    }
    finalL += LIGHT_L_LIFT;
    finalL = Math.min(finalL, LIGHT_L_MAX);
  }
  return finalL;
}

/**
 * Color transfer: preserve sofa luminance/texture from master; apply swatch palette chroma.
 */
export function recolorSofa(masterImage, mask, palette) {
  const { data, width, height, channels } = masterImage;
  const out = Buffer.from(data);
  const { lo, span } = computeSofaLuminanceMapRange(masterImage, mask);
  const isLight = palette.isNamedLight;

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;

    const p = j * channels;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    const u = clamp((lab.L - lo) / span, 0, 1);
    const tone = interpolateSwatchPalette(palette, u);
    const finalL = computeFinalLabL(lab.L, tone.L, isLight);
    const a = clamp(tone.a, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
    const b = clamp(tone.b, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
    const { r, g, b: bOut } = labToRgb(finalL, a, b);

    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = bOut;
    if (channels === 4) out[p + 3] = data[p + 3];
  }

  return out;
}

export async function processSwatch(swatchPath, masterImage, mask) {
  const resolved = resolveOriginalSwatchPath(swatchPath);
  if (!resolved) throw new Error(`Not an original swatch: ${swatchPath}`);

  const swatchName = basename(resolved, extname(resolved));
  const palette = await getSwatchPalette(resolved);

  const fmtTone = (t) => ({
    rgb: t.rgb,
    lab: [Math.round(t.L * 10) / 10, Math.round(t.a * 10) / 10, Math.round(t.b * 10) / 10],
  });

  console.log({
    swatchName,
    source: `input/swatches/${palette.sourceFile}`,
    extraction: palette.extractionMethod,
    shadow: fmtTone(palette.shadow),
    midtone: fmtTone(palette.midtone),
    highlight: fmtTone(palette.highlight),
    lightLeather: palette.isNamedLight,
    lBlend: palette.isNamedLight ? '52/48 shadowCompress +10 (max 96)' : '52/48',
  });

  const outData = recolorSofa(masterImage, mask, palette);
  const outPath = join(OUTPUT_DIR, `${swatchName}-fixed.png`);
  const bytes = await saveImage(outData, outPath, masterImage.width, masterImage.height, masterImage.channels);
  console.log(`  wrote ${swatchName}-fixed.png (${Math.round(bytes / 1024)} KB)`);
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
  let swatchFile = null;
  for (const a of args) {
    if (a === '--all') all = true;
    else if (a === '--currant' || a === '--current') swatchFile = DEFAULT_PREVIEW_SWATCH;
    else if (a.startsWith('--swatch=')) swatchFile = a.slice('--swatch='.length);
    else if (!a.startsWith('-')) swatchFile = a;
  }
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
  console.log('  method: sofa L/texture + swatch color palette (no texture transfer)');

  const sourceSofa = await loadImage(SOFA_PATH);
  console.log(`  ${sourceSofa.width}x${sourceSofa.height}`);

  const mask = await loadUpholsteryMask(MASK_PATH, sourceSofa.width, sourceSofa.height);
  const masterImage = buildNeutralGrayMaster(sourceSofa, mask);

  await saveImage(
    masterImage.data,
    MASTER_SOFA_PATH,
    masterImage.width,
    masterImage.height,
    masterImage.channels,
  );
  console.log(`  master: ${MASTER_SOFA_PATH}`);

  if (cli.mode === 'one') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    const { outPath } = await processSwatch(swPath, masterImage, mask);
    console.log(`\nDone: ${outPath}`);
    return;
  }

  for (const file of swatchFiles) {
    await processSwatch(join(SWATCH_DIR, file), masterImage, mask);
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
