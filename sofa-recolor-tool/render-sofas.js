/**
 * Simple LAB recolor: neutral-gray master sofa + manual mask.
 * Preserve photographic L; replace a/b with swatch median; mild L lift on light leathers only.
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

/** Named light leathers: blend master L toward bright swatch body (RGB luminance). */
const LIGHT_LEATHER_KEYWORDS = ['silk', 'eggshell', 'frost', 'parchment', 'vanilla', 'tusk', 'mist'];
const LIGHT_L_MASTER = 0.35;
const LIGHT_L_SWATCH = 0.65;
const LIGHT_L_CLAMP_LO = 125;
const LIGHT_L_CLAMP_HI = 235;
const LIGHT_SEAM_MASTER_L = 55;
const LIGHT_SEAM_CLAMP_LO = 75;
const LIGHT_SEAM_CLAMP_HI = 130;
const SWATCH_LUM_TRIM = 0.15;
const SWATCH_K_MEANS = 3;
const SWATCH_CLUSTER_POP_WEIGHT = 0.65;
const SWATCH_CLUSTER_SAT_WEIGHT = 0.35;

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
  const [r, g, bOut] = convert.lab.rgb([L, a, b]);
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

export function isNamedLightLeather(swatchStem) {
  const s = swatchStem.toLowerCase();
  return LIGHT_LEATHER_KEYWORDS.some((k) => s.includes(k));
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
 * Leather color: trim luminance extremes, k=3, pick dominant saturated cluster centroid.
 */
export async function getSwatchMedianLab(swatchPath) {
  const resolved = resolveOriginalSwatchPath(swatchPath) || resolve(swatchPath);
  if (!resolved.startsWith(resolve(SWATCH_DIR))) {
    throw new Error(`Swatch must be under input/swatches: ${swatchPath}`);
  }

  const swatchStem = basename(resolved, extname(resolved));
  const { data, info } = await sharp(resolved).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rawPixels = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = info.channels === 4 ? data[i + 3] : 255;
      if (alpha < 20 || isNearWhite(r, g, b)) continue;
      rawPixels.push({ r, g, b, lum: pixelBrightness(r, g, b) });
    }
  }

  if (rawPixels.length < SWATCH_K_MEANS) {
    throw new Error(`Not enough swatch pixels: ${resolved}`);
  }

  const sortedLum = rawPixels.map((p) => p.lum).sort((a, b) => a - b);
  const lo = percentileOfSorted(sortedLum, SWATCH_LUM_TRIM);
  const hi = percentileOfSorted(sortedLum, 1 - SWATCH_LUM_TRIM);
  const trimmed = rawPixels.filter((p) => p.lum >= lo && p.lum <= hi);
  const pixels = trimmed.length >= SWATCH_K_MEANS ? trimmed : rawPixels;

  const { centroids, labels } = kMeansRgb(pixels, SWATCH_K_MEANS);
  const leather = pickLeatherClusterCentroid(centroids, labels, pixels.length);
  const r = Math.round(leather.r);
  const g = Math.round(leather.g);
  const b = Math.round(leather.b);
  const lab = rgbToLab(r, g, b);

  return {
    meanL: lab.L,
    meanA: lab.a,
    meanB: lab.b,
    swatchLumRgb: pixelBrightness(r, g, b),
    clusterPop: leather.population,
    clusterSat: leather.saturation,
    isNamedLight: isNamedLightLeather(swatchStem),
    overallRGB: [r, g, b],
    pixelCount: pixels.length,
    sourceFile: basename(resolved),
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

/** RGB luminance for named light leathers; null = keep master LAB L. */
export function computeLightLeatherLum(masterLumRgb, swatch) {
  let finalL = masterLumRgb * LIGHT_L_MASTER + swatch.swatchLumRgb * LIGHT_L_SWATCH;
  finalL = clamp(finalL, LIGHT_L_CLAMP_LO, LIGHT_L_CLAMP_HI);
  if (masterLumRgb < LIGHT_SEAM_MASTER_L) {
    finalL = clamp(finalL, LIGHT_SEAM_CLAMP_LO, LIGHT_SEAM_CLAMP_HI);
  }
  return finalL;
}

/**
 * Masked pixels only: preserve master L (dark); named lights blend toward swatch body L.
 */
export function recolorSofa(masterImage, mask, swatch) {
  const { data, width, height, channels } = masterImage;
  const out = Buffer.from(data);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;

    const p = j * channels;
    const masterLum = pixelBrightness(data[p], data[p + 1], data[p + 2]);
    const a = clamp(swatch.meanA, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
    const b = clamp(swatch.meanB, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);

    let r;
    let g;
    let bOut;
    if (swatch.isNamedLight) {
      const finalLum = computeLightLeatherLum(masterLum, swatch);
      const baseLab = rgbToLab(finalLum, finalLum, finalLum);
      ({ r, g, b: bOut } = labToRgb(baseLab.L, a, b));
    } else {
      const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
      ({ r, g, b: bOut } = labToRgb(lab.L, a, b));
    }

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
  const swatch = await getSwatchMedianLab(resolved);

  console.log({
    swatchName,
    source: `input/swatches/${swatch.sourceFile}`,
    leatherLAB: [
      Math.round(swatch.meanL * 10) / 10,
      Math.round(swatch.meanA * 10) / 10,
      Math.round(swatch.meanB * 10) / 10,
    ],
    leatherRGB: swatch.overallRGB,
    clusterPop: Math.round((swatch.clusterPop ?? 0) * 100),
    clusterSat: Math.round((swatch.clusterSat ?? 0) * 100) / 100,
    pixelsSampled: swatch.pixelCount,
    lightLeather: swatch.isNamedLight,
    swatchLumRgb: swatch.isNamedLight ? Math.round(swatch.swatchLumRgb) : undefined,
  });

  const outData = recolorSofa(masterImage, mask, swatch);
  const outPath = join(OUTPUT_DIR, `${swatchName}.png`);
  const bytes = await saveImage(outData, outPath, masterImage.width, masterImage.height, masterImage.channels);
  console.log(`  wrote ${swatchName}.png (${Math.round(bytes / 1024)} KB)`);
  return { outPath, swatch };
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
  console.log('  method: neutral-gray master | median a/b | light L blend for silk/creams');

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
