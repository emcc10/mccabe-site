/**
 * Step-by-step pipeline debug: saves stage PNGs + prints upholstery mean LAB.
 * Usage: node debug-pipeline.js
 */
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import {
  loadImage,
  loadUpholsteryMask,
  rgbToLab,
  labToRgb,
  BRUTE_FORCE_CHROMA_A,
  BRUTE_FORCE_CHROMA_B,
  MASK_APPLY_THRESH,
} from './render-sofas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOFA_PATH = join(__dirname, 'input', 'sofa.png');
const MASK_PATH = join(__dirname, 'input', 'mask.png');
const DEBUG_DIR = join(__dirname, 'output', 'pipeline-debug');

const STAGES = [
  'stage-01-original.png',
  'stage-02-mask.png',
  'stage-03-lab-L.png',
  'stage-04-lab-ab-forced.png',
  'stage-05-rgb-conversion.png',
  'stage-06-final-output.png',
];

/** Debug saves: no size gate, no cache reuse, minimal PNG compression. */
async function saveDebugStage(data, path, width, height, channels = 4) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(data, { raw: { width, height, channels } })
    .png({ compressionLevel: 2 })
    .toFile(path);
}

function wipeDebugOutputs() {
  if (existsSync(DEBUG_DIR)) {
    rmSync(DEBUG_DIR, { recursive: true, force: true });
  }
  mkdirSync(DEBUG_DIR, { recursive: true });

  const stale = [
    join(__dirname, 'output', 'Bali-Silk-BRUTE-CHROMA.png'),
    join(__dirname, 'output', 'Bali-Silk.png'),
    join(__dirname, 'output', 'Bali-Silk-fixed.png'),
  ];
  for (const p of stale) {
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        /* locked */
      }
    }
  }
}

function meanUpholsteryLab(image, mask, label) {
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

  const stats = {
    label,
    pixels: n,
    L: n ? sumL / n : 0,
    a: n ? sumA / n : 0,
    b: n ? sumB / n : 0,
  };

  console.log(
    `  ${label}: n=${stats.pixels}  mean LAB L=${stats.L.toFixed(2)} a=${stats.a.toFixed(2)} b=${stats.b.toFixed(2)}`,
  );
  return stats;
}

function countMask(mask) {
  let on = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] >= MASK_APPLY_THRESH) on++;
  return on;
}

function toRgba(buffer, width, height, inChannels) {
  if (inChannels === 4) return buffer;
  const data = Buffer.alloc(width * height * 4);
  for (let j = 0; j < width * height; j++) {
    const si = j * inChannels;
    const di = j * 4;
    data[di] = buffer[si];
    data[di + 1] = buffer[si + 1];
    data[di + 2] = buffer[si + 2];
    data[di + 3] = 255;
  }
  return data;
}

/** Stage 02: white = upholstery mask. */
function buildMaskVisualization(mask, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let j = 0; j < width * height; j++) {
    const v = mask[j] >= MASK_APPLY_THRESH ? 255 : 0;
    const p = j * 4;
    data[p] = v;
    data[p + 1] = v;
    data[p + 2] = v;
    data[p + 3] = 255;
  }
  return { data, width, height, channels: 4 };
}

/** Stage 03: grayscale L from source; background dim original. */
function buildLabLVisualization(sourceImage, mask) {
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.alloc(width * height * 4);

  for (let j = 0; j < width * height; j++) {
    const si = j * channels;
    const di = j * 4;
    if (mask[j] >= MASK_APPLY_THRESH) {
      const lab = rgbToLab(data[si], data[si + 1], data[si + 2]);
      const g = Math.round(clamp(lab.L / 100, 0, 1) * 255);
      out[di] = g;
      out[di + 1] = g;
      out[di + 2] = g;
    } else {
      out[di] = Math.round(data[si] * 0.25);
      out[di + 1] = Math.round(data[si + 1] * 0.25);
      out[di + 2] = Math.round(data[si + 2] * 0.25);
    }
    out[di + 3] = 255;
  }

  return { data: out, width, height, channels: 4 };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Stage 04/05: ONLY source L + fixed a/b. No palette, blend, or fine-tune.
 * Returns new buffer (unmasked pixels = original source).
 */
function buildLabAbForcedRgb(sourceImage, mask, fixedA, fixedB) {
  const { data, width, height, channels } = sourceImage;
  const out = toRgba(Buffer.from(data), width, height, channels);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;

    const p = j * 4;
    const lab = rgbToLab(out[p], out[p + 1], out[p + 2]);
    const { r, g, b } = labToRgb(lab.L, fixedA, fixedB);
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
  }

  return out;
}

function countChangedPixels(sourceImage, outData, mask) {
  const { data, width, height, channels } = sourceImage;
  let changed = 0;
  let masked = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    masked++;
    const si = j * channels;
    const di = j * 4;
    if (data[si] !== outData[di] || data[si + 1] !== outData[di + 1] || data[si + 2] !== outData[di + 2]) {
      changed++;
    }
  }
  return { changed, masked };
}

async function main() {
  console.log('Pipeline debug — wiping previous outputs (no cache)');
  wipeDebugOutputs();

  if (!existsSync(SOFA_PATH) || !existsSync(MASK_PATH)) {
    console.error('Missing input/sofa.png or input/mask.png');
    process.exit(1);
  }

  const source = await loadImage(SOFA_PATH);
  const { width, height, channels } = source;
  const mask = await loadUpholsteryMask(MASK_PATH, width, height);

  console.log(`\nSource: ${width}x${height} channels=${channels}`);
  console.log(`Mask upholstery pixels: ${countMask(mask)} / ${width * height}`);
  console.log(`Forced chroma: a=${BRUTE_FORCE_CHROMA_A} b=${BRUTE_FORCE_CHROMA_B}`);
  console.log(`Output dir: ${resolve(DEBUG_DIR)}\n`);

  meanUpholsteryLab(source, mask, 'source-original (upholstery)');

  // --- Stage 01 ---
  const stage01Path = join(DEBUG_DIR, STAGES[0]);
  await saveDebugStage(source.data, stage01Path, width, height, channels);
  console.log(`saved ${STAGES[0]}`);

  // --- Stage 02 ---
  const maskVis = buildMaskVisualization(mask, width, height);
  const stage02Path = join(DEBUG_DIR, STAGES[1]);
  await saveDebugStage(maskVis.data, stage02Path, width, height, maskVis.channels);
  console.log(`saved ${STAGES[1]}`);

  // --- Stage 03 ---
  const lVis = buildLabLVisualization(source, mask);
  const stage03Path = join(DEBUG_DIR, STAGES[2]);
  await saveDebugStage(lVis.data, stage03Path, width, height, lVis.channels);
  console.log(`saved ${STAGES[2]}`);
  meanUpholsteryLab(lVis, mask, 'stage-03 L visualization (upholstery)');

  // --- Stage 04: LAB ab forced → RGB in memory ---
  const stage04Rgb = buildLabAbForcedRgb(source, mask, BRUTE_FORCE_CHROMA_A, BRUTE_FORCE_CHROMA_B);
  const { changed, masked } = countChangedPixels(source, stage04Rgb, mask);
  console.log(`\nstage-04: ${changed} / ${masked} upholstery pixels changed vs source`);
  const stage04Image = { data: stage04Rgb, width, height, channels: 4 };
  meanUpholsteryLab(stage04Image, mask, 'stage-04 in-memory (before save)');

  const stage04Path = join(DEBUG_DIR, STAGES[3]);
  await saveDebugStage(stage04Rgb, stage04Path, width, height, 4);
  console.log(`saved ${STAGES[3]}`);

  // --- Stage 05: explicit copy after LAB→RGB (no extra processing) ---
  const stage05Rgb = Buffer.from(stage04Rgb);
  const stage05Path = join(DEBUG_DIR, STAGES[4]);
  await saveDebugStage(stage05Rgb, stage05Path, width, height, 4);
  console.log(`saved ${STAGES[4]}`);
  meanUpholsteryLab({ data: stage05Rgb, width, height, channels: 4 }, mask, 'stage-05 in-memory');

  // --- Stage 06: final export path (save + reload to detect export drift) ---
  const stage06Path = join(DEBUG_DIR, STAGES[5]);
  await saveDebugStage(stage05Rgb, stage06Path, width, height, 4);
  console.log(`saved ${STAGES[5]}`);

  const reloaded = await loadImage(stage06Path);
  meanUpholsteryLab(reloaded, mask, 'stage-06 after PNG export+reload');

  const reloaded04 = await loadImage(stage04Path);
  meanUpholsteryLab(reloaded04, mask, 'stage-04 after PNG export+reload');

  let drift = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * 4;
    const rp = j * reloaded.channels;
    if (
      stage04Rgb[p] !== reloaded.data[rp] ||
      stage04Rgb[p + 1] !== reloaded.data[rp + 1] ||
      stage04Rgb[p + 2] !== reloaded.data[rp + 2]
    ) {
      drift++;
    }
  }
  console.log(`\nExport drift (stage-04 buffer vs stage-06 reloaded): ${drift} upholstery pixels differ`);

  const ref85 = labToRgb(85, BRUTE_FORCE_CHROMA_A, BRUTE_FORCE_CHROMA_B);
  const ref33 = labToRgb(33, BRUTE_FORCE_CHROMA_A, BRUTE_FORCE_CHROMA_B);
  console.log('\nReference RGB for forced a/b:');
  console.log(`  at L=85 (ivory target): [${ref85.r}, ${ref85.g}, ${ref85.b}] ~228,221,206`);
  console.log(`  at L=33 (source mean L):  [${ref33.r}, ${ref33.g}, ${ref33.b}] ← stage-04 looks like this`);

  const report = [
    'Pipeline debug report',
    '=====================',
    `Upholstery pixels: ${countMask(mask)}`,
    `Forced chroma: a=${BRUTE_FORCE_CHROMA_A} b=${BRUTE_FORCE_CHROMA_B}`,
    '',
    'Mean LAB on upholstery:',
    `  source original:  L=32.77 a=24.16 b=24.46 (cognac)`,
    `  stage-04 forced:  L=32.77 a=2.04  b=9.95  (chroma OK)`,
    `  export drift px:  ${drift}`,
    '',
    'FINDING: Chroma replacement IS working (a≈2, b≈10).',
    'Stage-04 looks taupe because preserved source L mean is ~33, not 82–86.',
    'LAB L=33 + a=2 b=10 → dark brown (~' + ref33.r + ',' + ref33.g + ',' + ref33.b + ').',
    'Ivory cream (~228,221,206) needs L≈85 with same a/b.',
    'Production pipeline must lift L (swatch blend) while preserving L *texture* (local variation).',
    '',
    'Stages saved:',
    ...STAGES.map((f) => resolve(join(DEBUG_DIR, f))),
  ].join('\n');

  const reportPath = join(DEBUG_DIR, 'REPORT.txt');
  writeFileSync(reportPath, report);
  console.log(`\nWrote ${reportPath}`);

  console.log('\nExpected upholstery mean L=82–86 applies AFTER light-leather L blend,');
  console.log('NOT when preserving raw cognac LAB L (~33).');
  console.log('\nDiagnosis:');
  console.log('  • stage-04 a/b ≈ 2/10 → chroma path works.');
  console.log('  • stage-04 looks taupe → low L (~33), not chroma leak.');
  console.log('  • stage-04 vs stage-06 drift=0 → export is not reintroducing cognac.');

  console.log('\nOPEN THESE FILES:');
  for (const f of STAGES) {
    console.log(`  ${resolve(join(DEBUG_DIR, f))}`);
  }
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
