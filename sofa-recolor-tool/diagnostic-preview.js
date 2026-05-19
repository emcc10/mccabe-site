/**
 * Texture diagnostic: swatch patches + transfer-map debug (+ optional sofa render).
 * Usage:
 *   node diagnostic-preview.js Bali-Silk --transfer-debug
 *   node diagnostic-preview.js Bali-Silk --render
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
import {
  buildTransferMaps,
  validateTransferRgbMap,
  saveTransferDebugImages,
} from './texture-transfer.js';

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

async function runOneSwatch(swatchArg, opts, masterImage, mask, width, height, channels) {
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

  if (opts.transferDebug && masterImage) {
    console.log('\n  --- Transfer map debug (before sofa) ---');
    const maps = buildTransferMaps(masterImage, mask, texture);
    const debugPaths = await saveTransferDebugImages(maps, mask, outDir);
    console.log('  transfer stats:', maps.stats);
    console.log('  debug-sampled-rgb.png (must look like leather texture on upholstery shape)');
    console.log('  debug-sofa-uv-lookup.png (R=patch U, G=patch V, B=sofa luminance u)');
    console.log('  debug-band-assignment.png (64=shadow, 128=mid, 192=highlight)');
    for (const [k, p] of Object.entries(debugPaths)) {
      console.log(`    ${k}: ${basename(p)}`);
    }

    validateTransferRgbMap(maps, mask);
    console.log('  transfer validation: PASS');

    if (opts.renderSofa) {
      const finalData = recolorSofa(masterImage, mask, texture, {
        transferMaps: maps,
        skipTransferValidation: true,
      });
      await saveImage(finalData, join(outDir, 'final-output.png'), width, height, channels);
      console.log('  saved: final-output.png (after transfer verified)');
    } else {
      console.log('  (sofa render skipped — add --render after transfer map looks correct)');
    }
  } else if (opts.renderSofa) {
    console.error('  --render requires sofa/mask; use --transfer-debug --render together');
    return false;
  } else {
    console.log('  (transfer debug skipped — use --transfer-debug)');
  }

  return true;
}

async function main() {
  const argv = process.argv.slice(2);
  const renderSofa = argv.includes('--render');
  const transferDebug = argv.includes('--transfer-debug') || renderSofa;
  const swatchArgs = argv.filter((a) => !a.startsWith('--'));
  const swatches = swatchArgs.length ? swatchArgs : DEFAULT_SWATCHES;

  console.log('Texture diagnostic');
  console.log(`Swatches: ${swatches.join(', ')}`);
  if (transferDebug) {
    console.log('Mode: transfer-map debug' + (renderSofa ? ' + sofa render' : ''));
  }

  let masterImage;
  let mask;
  let width;
  let height;
  let channels;

  if (transferDebug) {
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

  const opts = { renderSofa, transferDebug };
  let ok = 0;
  for (const arg of swatches) {
    if (await runOneSwatch(arg, opts, masterImage, mask, width, height, channels)) ok++;
  }

  if (!ok) process.exit(1);
  console.log(`\nDone. ${ok} swatch(s). Open debug-sampled-rgb.png first — it must match the swatch material.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
