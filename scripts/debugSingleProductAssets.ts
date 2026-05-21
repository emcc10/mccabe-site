#!/usr/bin/env npx tsx
/**
 * Mask/debug validation for a single product (no production swatch render).
 *
 * Usage:
 *   npm run debug:assets -- TEST-SOFA
 *   npm run debug:assets -- TEST-SOFA --rebuild-seg
 *   npm run debug:assets -- TEST-SOFA --sanity-render
 */
import { writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { sourceImagePath } from '../src/recolor/cache.js';
import { productDebugDir } from '../src/recolor/debugAssets.js';
import {
  formatMaskValidationReport,
  validateProductMasks,
} from '../src/recolor/maskValidation.js';
import {
  writeDebugAssetPreviews,
} from '../src/recolor/debugAssets.js';
import { renderDebugSanitySwatch } from '../src/recolor/debugRender.js';
import { ensureProductAssets } from '../src/recolor/pipeline.js';
import { loadMask } from '../src/recolor/masks.js';
import { productDir } from '../src/recolor/paths.js';
import { getSingleProductConfig } from '../src/recolor/singleProductConfig.js';
import { buildSegmentationForProduct } from '../src/recolor/segment.js';
import { saveDerivedMaps } from '../src/recolor/maps.js';
import { loadImageRGBA } from '../src/recolor/imageIO.js';
import { loadSingleProductAssets, saveSingleProductAssets } from '../src/recolor/productAssets.js';

const args = process.argv.slice(2);
const productCode = args.find((a) => !a.startsWith('--')) ?? 'TEST-SOFA';
const rebuildSeg = args.includes('--rebuild-seg');
const sanityRender = args.includes('--sanity-render');

const srcPath = resolve(sourceImagePath(productCode));
console.log(`Debug asset validation: ${productCode}`);
console.log(`  source: ${srcPath}\n`);

if (rebuildSeg) {
  const config = getSingleProductConfig(productCode);
  const image = await loadImageRGBA(srcPath);
  const seg = await buildSegmentationForProduct(productCode, srcPath, config);
  await saveDerivedMaps(productCode, image, seg.upholstery);
  const assets = loadSingleProductAssets(productCode);
  if (assets) {
    assets.updatedAt = new Date().toISOString();
    assets.segmentationApproved = false;
    saveSingleProductAssets(assets);
  }
  console.log('  rebuilt segmentation + maps\n');
} else {
  await ensureProductAssets(productCode, false);
}

const debugPaths = await writeDebugAssetPreviews(productCode, srcPath);
const debugDir = productDebugDir(productCode);

const upholstery = await loadMask(join(productDir(productCode), 'upholstery-mask.png'));
const legs = await loadMask(join(productDir(productCode), 'leg-mask.png'));
const alpha = await loadMask(join(productDir(productCode), 'alpha.png'));
const trim = await loadMask(join(productDir(productCode), 'trim-mask.png'));

const validation = validateProductMasks(alpha, upholstery, legs, trim);
const report = formatMaskValidationReport(validation);
console.log(report);
console.log('');

const validationPath = join(debugDir, 'validation.json');
writeFileSync(
  validationPath,
  JSON.stringify({ productCode, passed: validation.passed, failures: validation.failures }, null, 2),
);

console.log('Debug previews written:');
const files = [
  ['A', 'source-preview.png', debugPaths.sourcePreview],
  ['B', 'alpha-preview.png', debugPaths.alphaPreview],
  ['C', 'upholstery-mask-preview.png', debugPaths.upholsteryMaskPreview],
  ['D', 'leg-mask-preview.png', debugPaths.legMaskPreview],
  ['E', 'trim-mask-preview.png', debugPaths.trimMaskPreview],
  ['F', 'upholstery-overlay-preview.png', debugPaths.upholsteryOverlayPreview],
  ['G', 'leg-overlay-preview.png', debugPaths.legOverlayPreview],
  ['H', 'combined-overlay-preview.png', debugPaths.combinedOverlayPreview],
  ['I', 'detail-map-preview.png', debugPaths.detailMapPreview],
  ['J', 'shadow-map-preview.png', debugPaths.shadowMapPreview],
  ['K', 'highlight-map-preview.png', debugPaths.highlightMapPreview],
];
for (const [, name, path] of files) {
  console.log(`  ${name}`);
  console.log(`    ${path}`);
}
console.log(`  validation.json`);
console.log(`    ${resolve(validationPath)}`);

if (!validation.passed) {
  console.log('\nRecolor BLOCKED. Fix masks, re-run with --rebuild-seg if needed.');
  console.log('Failed masks:');
  const masks = new Set(validation.failures.map((f) => f.mask));
  for (const m of masks) console.log(`  - ${m}`);
  for (const f of validation.failures) {
    console.log(`  • [${f.mask}] ${f.rule}: ${f.message}`);
  }
  process.exit(1);
}

console.log('\nMask validation PASSED. Production swatch render remains disabled until you approve segmentation.');

if (sanityRender) {
  console.log('\nSanity render (debug-flat-safe, BALI-SILK)...');
  const sanity = await renderDebugSanitySwatch(productCode, 'BALI-SILK');
  console.log(`  final-debug-render.png: ${sanity.finalDebugRender}`);
  console.log(`  sanity-comparison.png:  ${sanity.sideBySide}`);
} else {
  console.log('\nOptional sanity recolor (masks passed):');
  console.log(`  npm run debug:assets -- ${productCode} --sanity-render`);
}
