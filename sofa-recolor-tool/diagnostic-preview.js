/**
 * Extraction diagnostic — shadow / mid / highlight chips only (no sofa render).
 * Usage: node diagnostic-preview.js Bali-Silk
 */
import { mkdirSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { getSwatchPalette, resolveOriginalSwatchPath } from './render-sofas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
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

async function runOneSwatch(swatchArg) {
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
  console.log(`  method: ${palette.extractionMethod}`);
  if (palette.bandCounts) {
    console.log(`  bands: ${JSON.stringify(palette.bandCounts)}`);
  }
  logTone('shadow', palette.shadow);
  logTone('midtone', palette.midtone);
  logTone('highlight', palette.highlight);

  await saveChip(join(outDir, 'extracted-shadow-color.png'), palette.shadow.rgb);
  await saveChip(join(outDir, 'extracted-midtone-color.png'), palette.midtone.rgb);
  await saveChip(join(outDir, 'extracted-highlight-color.png'), palette.highlight.rgb);
  console.log('  chips: extracted-shadow/midtone/highlight-color.png');
  console.log('  (sofa render skipped until chips match swatch)');

  return true;
}

async function main() {
  const swatchArgs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SWATCHES;
  console.log('Extraction diagnostic — chips only, no sofa render');
  console.log(`Swatches: ${swatchArgs.join(', ')}`);

  let ok = 0;
  for (const arg of swatchArgs) {
    if (await runOneSwatch(arg)) ok++;
  }

  if (!ok) process.exit(1);
  console.log(`\nDone. ${ok} swatch(s) in output/diagnostic/<name>/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
