#!/usr/bin/env npx tsx
/**
 * Usage:
 *   npm run build:assets -- TEST-SOFA [path/to/cognac-source.png] [path/to/mask.override.png]
 *
 * Copies ONLY the original cognac source to product-assets/.../source.png
 * Never uses render-cache or swatch renders as input.
 */
import { resolve } from 'path';
import { REPO_ROOT } from '../src/recolor/paths.js';
import { bootstrapFromLegacySofaTool, ensureProductAssets } from '../src/recolor/pipeline.js';
import { saveSingleProductAssets, createEmptyAssetsRecord } from '../src/recolor/productAssets.js';
import {
  assertValidBuildInputPath,
  removeSwatchRendersFromProductDir,
} from '../src/recolor/sourceGuard.js';

const productCode = process.argv[2] ?? 'TEST-SOFA';
const sourceArg = process.argv[3];
const maskArg = process.argv[4];

/** Canonical cognac catalog photo — never a render output */
const COGNAC_SOURCE = resolve(REPO_ROOT, 'sofa-recolor-tool', 'input', 'sofa.png');
const DEFAULT_MASK = resolve(REPO_ROOT, 'sofa-recolor-tool', 'input', 'mask.png');

const sourcePath = resolve(sourceArg ?? COGNAC_SOURCE);
const maskPath = maskArg ? resolve(maskArg) : DEFAULT_MASK;

assertValidBuildInputPath(sourcePath, 'build input');

console.log(`Building assets for ${productCode}`);
console.log(`  cognac source (input):  ${sourcePath}`);

const removed = removeSwatchRendersFromProductDir(productCode);
if (removed.length) {
  console.log('  removed stray swatch renders from product-assets:');
  for (const p of removed) console.log(`    - ${p}`);
}

const { sourcePath: writtenSource } = bootstrapFromLegacySofaTool(productCode, sourcePath, maskPath);
console.log(`  source.png (written):   ${writtenSource}`);

let record = createEmptyAssetsRecord(productCode);
record.baseImageUrl = `/product-assets/${productCode}/source.png`;
saveSingleProductAssets(record);

const assets = await ensureProductAssets(productCode, true);
console.log('\nAssets built. assets.json:');
console.log(JSON.stringify(assets, null, 2));
console.log(`\nApprove when ready: npm run approve:product -- ${productCode}`);
