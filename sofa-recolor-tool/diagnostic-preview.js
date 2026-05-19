/**
 * Texture extraction diagnostic — real swatch patches (not flat color chips).
 * Usage: node diagnostic-preview.js Bali-Spider Evoque-Atlantic Bali-Silk
 *        node diagnostic-preview.js Bali-Silk --render  (include sofa preview)
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
  getSwatchTexture,
  resolveOriginalSwatchPath,
} from './render-sofas.js';
import { getMaterialClass, getMaterialBlendProfile } from './material-blend.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOFA_PATH = join(__dirname, 'input', 'sofa.png');
const MASK_PATH = join(__dirname, 'input', 'mask.png');
const DEFAULT_SWATCHES = ['Bali-Spider', 'Evoque-Atlantic', 'Bali-Silk'];

async function saveTexturePatch(outPath, patch) {
  await sharp(patch.data, {
    raw: { width: patch.width, height: patch.height, channels: patch.channels },
  })
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

function logPatch(label, patch) {
  const [r, g, b] = patch.stats.rgb;
  console.log(
    `  ${label}: ${patch.width}x${patch.height} patch @ (${patch.origin.x},${patch.origin.y}) coverage=${patch.coverage}  median RGB [${r}, ${g}, ${b}]`,
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

  const texture = await getSwatchTexture(swatchPath);
  console.log(`  method: ${texture.extractionMethod}`);
  console.log(`  material: ${getMaterialClass(texture)}`, getMaterialBlendProfile(texture));
  logPatch('shadow texture', texture.patches.shadow);
  logPatch('midtone texture', texture.patches.midtone);
  logPatch('highlight texture', texture.patches.highlight);

  await saveTexturePatch(
    join(outDir, 'extracted-shadow-texture.png'),
    texture.patches.shadow,
  );
  await saveTexturePatch(
    join(outDir, 'extracted-midtone-texture.png'),
    texture.patches.midtone,
  );
  await saveTexturePatch(
    join(outDir, 'extracted-highlight-texture.png'),
    texture.patches.highlight,
  );
  console.log('  saved: extracted-shadow/midtone/highlight-texture.png');

  if (renderSofa && masterImage) {
    const finalData = recolorSofa(masterImage, mask, texture);
    await saveImage(finalData, join(outDir, 'final-output.png'), width, height, channels);
    console.log('  saved: final-output.png (texture transfer preview)');
  } else {
    console.log('  (sofa render skipped — use --render to preview transfer)');
  }

  return true;
}

async function main() {
  const argv = process.argv.slice(2);
  const renderSofa = argv.includes('--render');
  const swatchArgs = argv.filter((a) => !a.startsWith('--'));
  const swatches = swatchArgs.length ? swatchArgs : DEFAULT_SWATCHES;

  console.log('Texture extraction diagnostic (real swatch patches)');
  console.log(`Swatches: ${swatches.join(', ')}`);

  let masterImage;
  let mask;
  let width;
  let height;
  let channels;

  if (renderSofa) {
    if (!existsSync(SOFA_PATH) || !existsSync(MASK_PATH)) {
      console.error('Missing input/sofa.png or input/mask.png (required for --render)');
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
  console.log(`\nDone. ${ok} swatch(s) — open texture PNGs to verify grain/variation.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
