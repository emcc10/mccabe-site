/**
 * Pipeline diagnostic — one swatch, six stage images (no batch, no formula changes).
 * Usage: node diagnostic-preview.js [Bali-Silk]
 */
import { mkdirSync, existsSync, copyFileSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import {
  loadImage,
  saveImage,
  loadUpholsteryMask,
  buildNeutralGrayMaster,
  getSwatchMedianLab,
  recolorSofa,
  resolveOriginalSwatchPath,
  rgbToLab,
  labToRgb,
} from './render-sofas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOFA_PATH = join(__dirname, 'input', 'sofa.png');
const MASK_PATH = join(__dirname, 'input', 'mask.png');
const MASK_APPLY_THRESH = 128;
const LAB_CHROMA_CLAMP = 72;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Chroma only: master L unchanged, swatch cluster a/b applied. */
function recolorChromaOnly(masterImage, mask, swatch) {
  const { data, width, height, channels } = masterImage;
  const out = Buffer.from(data);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    const a = clamp(swatch.meanA, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
    const b = clamp(swatch.meanB, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
    const { r, g, b: bOut } = labToRgb(lab.L, a, b);
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = bOut;
    if (channels === 4) out[p + 3] = data[p + 3];
  }

  return out;
}

/** Solid chip showing extracted cluster centroid RGB. */
function makeSwatchColorChip(r, g, b, size = 320) {
  const channels = 3;
  const data = Buffer.alloc(size * size * channels);
  for (let i = 0; i < size * size; i++) {
    const p = i * channels;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
  }
  return { data, width: size, height: size, channels };
}

async function main() {
  const swatchArg = process.argv[2] || 'Bali-Silk';
  const swatchPath = resolveOriginalSwatchPath(`${swatchArg}.jpg`) ||
    resolveOriginalSwatchPath(`${swatchArg}.jpeg`);
  if (!swatchPath) {
    console.error(`Swatch not found: ${swatchArg}`);
    process.exit(1);
  }
  if (!existsSync(SOFA_PATH) || !existsSync(MASK_PATH)) {
    console.error('Missing input/sofa.png or input/mask.png');
    process.exit(1);
  }

  const swatchName = basename(swatchPath, extname(swatchPath));
  const outDir = join(__dirname, 'output', 'diagnostic', swatchName);
  mkdirSync(outDir, { recursive: true });

  console.log(`Diagnostic preview: ${swatchName}`);
  console.log(`Output: ${outDir}\n`);

  const sourceSofa = await loadImage(SOFA_PATH);
  const { width, height, channels } = sourceSofa;
  const mask = await loadUpholsteryMask(MASK_PATH, width, height);
  const masterImage = buildNeutralGrayMaster(sourceSofa, mask);
  const swatch = await getSwatchMedianLab(swatchPath);

  const [cr, cg, cb] = swatch.overallRGB;

  // 1. base-sofa.png
  await saveImage(sourceSofa.data, join(outDir, 'base-sofa.png'), width, height, channels);
  console.log('1. base-sofa.png — source cognac photo');

  // 2. mask.png — copy of manual mask used by pipeline
  copyFileSync(MASK_PATH, join(outDir, 'mask.png'));
  console.log('2. mask.png — manual upholstery mask (from input/mask.png)');

  // 3. master-neutral-sofa.png
  await saveImage(
    masterImage.data,
    join(outDir, 'master-neutral-sofa.png'),
    width,
    height,
    masterImage.channels,
  );
  console.log('3. master-neutral-sofa.png — gray master (L from photo, a/b removed)');

  // 4. extracted-swatch-color.png
  const chip = makeSwatchColorChip(cr, cg, cb, 512);
  await sharp(chip.data, { raw: { width: chip.width, height: chip.height, channels: chip.channels } })
    .png()
    .toFile(join(outDir, 'extracted-swatch-color.png'));
  console.log(`4. extracted-swatch-color.png — k-means centroid RGB [${cr}, ${cg}, ${cb}]`);
  console.log(
    `   LAB L=${swatch.meanL.toFixed(1)} a=${swatch.meanA.toFixed(1)} b=${swatch.meanB.toFixed(1)}`,
  );
  console.log(
    `   cluster pop=${Math.round((swatch.clusterPop ?? 0) * 100)}% sat=${(swatch.clusterSat ?? 0).toFixed(2)}`,
  );

  // 5. recolored-before-luminance.png — chroma only, master L 100%
  const chromaOnly = recolorChromaOnly(masterImage, mask, swatch);
  await saveImage(
    chromaOnly,
    join(outDir, 'recolored-before-luminance.png'),
    width,
    height,
    channels,
  );
  console.log('5. recolored-before-luminance.png — cluster a/b only, master L unchanged');

  // 6. final-output.png — current pipeline (L blend 72/28 for named light)
  const finalData = recolorSofa(masterImage, mask, swatch);
  await saveImage(finalData, join(outDir, 'final-output.png'), width, height, channels);
  console.log(
    `6. final-output.png — production recolor (L blend ${swatch.isNamedLight ? '72/28' : '82/18'})`,
  );

  console.log('\nDone. Compare stages 3→5→6 to see where depth or color breaks.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
