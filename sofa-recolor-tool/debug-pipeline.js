/**
 * Step-by-step pipeline debug: saves stage PNGs + prints upholstery mean LAB.
 * Usage: node debug-pipeline.js
 */
import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import {
  loadImage,
  saveImage,
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

/** Stage 02: white = upholstery mask. */
function buildMaskVisualization(mask, width, height) {
  const channels = 3;
  const data = Buffer.alloc(width * height * channels);
  for (let j = 0; j < width * height; j++) {
    const v = mask[j] >= MASK_APPLY_THRESH ? 255 : 0;
    const p = j * channels;
    data[p] = v;
    data[p + 1] = v;
    data[p + 2] = v;
  }
  return { data, width, height, channels };
}

/** Stage 03: grayscale L from source; background dim original. */
function buildLabLVisualization(sourceImage, mask) {
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.alloc(width * height * channels);

  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    if (mask[j] >= MASK_APPLY_THRESH) {
      const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
      const g = Math.round(clamp(lab.L / 100, 0, 1) * 255);
      out[p] = g;
      out[p + 1] = g;
      out[p + 2] = g;
    } else {
      out[p] = Math.round(data[p] * 0.25);
      out[p + 1] = Math.round(data[p + 1] * 0.25);
      out[p + 2] = Math.round(data[p + 2] * 0.25);
    }
    if (channels === 4) out[p + 3] = data[p + 3];
  }

  return { data: out, width, height, channels };
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
  const out = Buffer.from(data);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;

    const p = j * channels;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    const { r, g, b } = labToRgb(lab.L, fixedA, fixedB);
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
    if (channels === 4) out[p + 3] = data[p + 3];
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
    const p = j * channels;
    if (data[p] !== outData[p] || data[p + 1] !== outData[p + 1] || data[p + 2] !== outData[p + 2]) {
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
  await saveImage(source.data, stage01Path, width, height, channels);
  console.log(`saved ${STAGES[0]}`);

  // --- Stage 02 ---
  const maskVis = buildMaskVisualization(mask, width, height);
  const stage02Path = join(DEBUG_DIR, STAGES[1]);
  await saveImage(maskVis.data, stage02Path, width, height, maskVis.channels);
  console.log(`saved ${STAGES[1]}`);

  // --- Stage 03 ---
  const lVis = buildLabLVisualization(source, mask);
  const stage03Path = join(DEBUG_DIR, STAGES[2]);
  await saveImage(lVis.data, stage03Path, width, height, lVis.channels);
  console.log(`saved ${STAGES[2]}`);
  meanUpholsteryLab(lVis, mask, 'stage-03 L visualization (upholstery)');

  // --- Stage 04: LAB ab forced → RGB in memory ---
  const stage04Rgb = buildLabAbForcedRgb(source, mask, BRUTE_FORCE_CHROMA_A, BRUTE_FORCE_CHROMA_B);
  const { changed, masked } = countChangedPixels(source, stage04Rgb, mask);
  console.log(`\nstage-04: ${changed} / ${masked} upholstery pixels changed vs source`);
  const stage04Image = { data: stage04Rgb, width, height, channels };
  meanUpholsteryLab(stage04Image, mask, 'stage-04 in-memory (before save)');

  const stage04Path = join(DEBUG_DIR, STAGES[3]);
  await saveImage(stage04Rgb, stage04Path, width, height, channels);
  console.log(`saved ${STAGES[3]}`);

  // --- Stage 05: explicit copy after LAB→RGB (no extra processing) ---
  const stage05Rgb = Buffer.from(stage04Rgb);
  const stage05Path = join(DEBUG_DIR, STAGES[4]);
  await saveImage(stage05Rgb, stage05Path, width, height, channels);
  console.log(`saved ${STAGES[4]}`);
  meanUpholsteryLab({ data: stage05Rgb, width, height, channels }, mask, 'stage-05 in-memory');

  // --- Stage 06: final export path (save + reload to detect export drift) ---
  const stage06Path = join(DEBUG_DIR, STAGES[5]);
  await saveImage(stage05Rgb, stage06Path, width, height, channels);
  console.log(`saved ${STAGES[5]}`);

  const reloaded = await loadImage(stage06Path);
  meanUpholsteryLab(reloaded, mask, 'stage-06 after PNG export+reload');

  const reloaded04 = await loadImage(stage04Path);
  meanUpholsteryLab(reloaded04, mask, 'stage-04 after PNG export+reload');

  let drift = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    if (
      stage04Rgb[p] !== reloaded.data[p] ||
      stage04Rgb[p + 1] !== reloaded.data[p + 1] ||
      stage04Rgb[p + 2] !== reloaded.data[p + 2]
    ) {
      drift++;
    }
  }
  console.log(`\nExport drift (stage-04 buffer vs stage-06 reloaded): ${drift} upholstery pixels differ`);

  console.log('\nExpected upholstery mean (approx): L=82–86  a=2–4  b=9–12');
  console.log('\nDiagnosis:');
  console.log('  • If stage-04 mean a/b are NOT ~2/10 → LAB replacement logic failed in memory.');
  console.log('  • If stage-04 looks taupe but mean a/b ARE ~2/10 → display/L channel issue.');
  console.log('  • If stage-04 OK but stage-06 mean drifts → PNG/export reintroducing color.');
  console.log('  • If changed pixels << masked count → mask may not cover upholstery.');

  console.log('\nOPEN THESE FILES:');
  for (const f of STAGES) {
    console.log(`  ${resolve(join(DEBUG_DIR, f))}`);
  }
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
