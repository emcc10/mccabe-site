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

/** Mild L lift for very light swatches (LAB L scale 0–100). */
const LIGHT_SWATCH_RGB_AVG = 145;
const LIGHT_LIFT_BLEND = 0.12;
const LIGHT_LIFT_TARGET_L = 82;

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
 * Median LAB of all non-background swatch pixels (simple color anchor).
 */
export async function getSwatchMedianLab(swatchPath) {
  const resolved = resolveOriginalSwatchPath(swatchPath) || resolve(swatchPath);
  if (!resolved.startsWith(resolve(SWATCH_DIR))) {
    throw new Error(`Swatch must be under input/swatches: ${swatchPath}`);
  }

  const { data, info } = await sharp(resolved).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const Ls = [];
  const As = [];
  const Bs = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = info.channels === 4 ? data[i + 3] : 255;
      if (alpha < 20 || isNearWhite(r, g, b)) continue;
      const lab = rgbToLab(r, g, b);
      Ls.push(lab.L);
      As.push(lab.a);
      Bs.push(lab.b);
    }
  }

  if (!Ls.length) {
    throw new Error(`No swatch pixels: ${resolved}`);
  }

  const rgbAvg = computeSwatchRgbAvg(data, info.width, info.height, info.channels);
  const meanL = medianOf(Ls);
  const meanA = medianOf(As);
  const meanB = medianOf(Bs);
  const meanRgb = labToRgb(meanL, meanA, meanB);

  return {
    meanL,
    meanA,
    meanB,
    rgbAvg,
    isLightSwatch: rgbAvg > LIGHT_SWATCH_RGB_AVG || meanL > 68,
    overallRGB: [meanRgb.r, meanRgb.g, meanRgb.b],
    pixelCount: Ls.length,
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
      isLightSwatch: s.isLightSwatch,
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

export function computeFinalLabL(originalL, swatch) {
  if (!swatch.isLightSwatch) {
    return originalL;
  }
  return originalL * (1 - LIGHT_LIFT_BLEND) + LIGHT_LIFT_TARGET_L * LIGHT_LIFT_BLEND;
}

/**
 * Masked pixels only: keep L (mild lift on light swatches), swatch median a/b.
 */
export function recolorSofa(masterImage, mask, swatch) {
  const { data, width, height, channels } = masterImage;
  const out = Buffer.from(data);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;

    const p = j * channels;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    const finalL = computeFinalLabL(lab.L, swatch);
    const a = clamp(swatch.meanA, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
    const b = clamp(swatch.meanB, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
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
  const swatch = await getSwatchMedianLab(resolved);

  console.log({
    swatchName,
    source: `input/swatches/${swatch.sourceFile}`,
    medianLAB: [
      Math.round(swatch.meanL * 10) / 10,
      Math.round(swatch.meanA * 10) / 10,
      Math.round(swatch.meanB * 10) / 10,
    ],
    overallRGB: swatch.overallRGB,
    pixelsSampled: swatch.pixelCount,
    lightLift: swatch.isLightSwatch,
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
  console.log('  method: neutral-gray master | preserve L | swatch median a/b');

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
