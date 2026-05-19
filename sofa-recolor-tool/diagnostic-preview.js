/**
 * Color-transfer diagnostic — extracted palette chips + optional sofa render.
 * No swatch texture tiling. Usage: node diagnostic-preview.js Bali-Silk --render
 */
import { mkdirSync, existsSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import {
  loadImage,
  saveImage,
  loadUpholsteryMask,
  buildNeutralGrayMaster,
  recolorSofa,
  getSwatchPalette,
  resolveOriginalSwatchPath,
} from './render-sofas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOFA_PATH = join(__dirname, 'input', 'sofa.png');
const MASK_PATH = join(__dirname, 'input', 'mask.png');
const DEFAULT_SWATCHES = ['Bali-Silk'];
const CHIP_SIZE = 512;

function makeColorChip(r, g, b, size = CHIP_SIZE) {
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

async function saveChip(outPath, rgb) {
  const chip = makeColorChip(rgb[0], rgb[1], rgb[2]);
  await sharp(chip.data, { raw: { width: chip.width, height: chip.height, channels: chip.channels } })
    .png()
    .toFile(outPath);
}

function resolveSwatchPath(name) {
  const stem = basename(name, extname(name));
  return (
    resolveOriginalSwatchPath(`${stem}.jpg`) ||
    resolveOriginalSwatchPath(`${stem}.jpeg`) ||
    resolveOriginalSwatchPath(name)
  );
}

function logTone(label, tone) {
  const [r, g, b] = tone.rgb;
  console.log(
    `  ${label}: RGB [${r}, ${g}, ${b}]  LAB L=${tone.L.toFixed(1)} a=${tone.a.toFixed(1)} b=${tone.b.toFixed(1)}`,
  );
}

async function runOneSwatch(swatchArg, renderSofa, masterImage, mask, width, height, channels) {
  const swatchPath = resolveSwatchPath(swatchArg);
  if (!swatchPath) {
    console.error(`Swatch not found: ${swatchArg}`);
    return false;
  }

  const swatchName = basename(swatchPath, extname(swatchPath));
  const outDir = join(__dirname, 'output', 'diagnostic', swatchName);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n=== ${swatchName} ===`);
  console.log(`Output: ${outDir}`);

  const palette = await getSwatchPalette(swatchPath);
  console.log(`  extraction: ${palette.extractionMethod} (color only, no texture transfer)`);
  logTone('shadow', palette.shadow);
  logTone('midtone', palette.midtone);
  logTone('highlight', palette.highlight);

  await saveChip(join(outDir, 'extracted-shadow-color.png'), palette.shadow.rgb);
  await saveChip(join(outDir, 'extracted-midtone-color.png'), palette.midtone.rgb);
  await saveChip(join(outDir, 'extracted-highlight-color.png'), palette.highlight.rgb);
  console.log('  saved: extracted-shadow/midtone/highlight-color.png (solid swatch colors)');

  if (renderSofa && masterImage) {
    const finalData = recolorSofa(masterImage, mask, palette);
    await saveImage(finalData, join(outDir, 'final-output-fixed.png'), width, height, channels);
    console.log('  saved: final-output-fixed.png (sofa texture + swatch color)');
  } else {
    console.log('  (sofa render skipped — use --render)');
  }

  return true;
}

async function main() {
  const argv = process.argv.slice(2);
  const renderSofa = argv.includes('--render');
  const swatchArgs = argv.filter((a) => !a.startsWith('--'));
  const swatches = swatchArgs.length ? swatchArgs : DEFAULT_SWATCHES;

  console.log('Color-transfer diagnostic (sofa texture preserved, swatch color only)');

  let masterImage;
  let mask;
  let width;
  let height;
  let channels;

  if (renderSofa) {
    if (!existsSync(SOFA_PATH) || !existsSync(MASK_PATH)) {
      console.error('Missing input/sofa.png or input/mask.png');
      process.exit(1);
    }
    const sourceSofa = await loadImage(SOFA_PATH);
    width = sourceSofa.width;
    height = sourceSofa.height;
    channels = sourceSofa.channels;
    mask = await loadUpholsteryMask(MASK_PATH, width, height);
    masterImage = buildNeutralGrayMaster(sourceSofa, mask);
  }

  let ok = 0;
  for (const arg of swatches) {
    if (await runOneSwatch(arg, renderSofa, masterImage, mask, width, height, channels)) ok++;
  }

  if (!ok) process.exit(1);
  console.log(`\nDone. ${ok} swatch(s).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
