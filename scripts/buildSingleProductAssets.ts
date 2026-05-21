#!/usr/bin/env npx tsx
/**
 * Usage:
 *   npm run build:assets -- TEST-SOFA [path/to/source.png] [path/to/optional-mask.override.png]
 */
import { join } from 'path';
import { REPO_ROOT } from '../src/recolor/paths.js';
import { bootstrapFromLegacySofaTool, ensureProductAssets } from '../src/recolor/pipeline.js';
import { saveSingleProductAssets, createEmptyAssetsRecord } from '../src/recolor/productAssets.js';

const productCode = process.argv[2] ?? 'TEST-SOFA';
const sourceArg = process.argv[3];
const maskArg = process.argv[4];

const defaultSource = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'sofa.png');
const defaultMask = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'mask.png');

const sourcePath = sourceArg ?? defaultSource;
const maskPath = maskArg ?? defaultMask;

console.log(`Building assets for ${productCode}`);
console.log(`  source: ${sourcePath}`);
if (maskPath) console.log(`  optional override mask: ${maskPath}`);

bootstrapFromLegacySofaTool(productCode, sourcePath, maskPath);
let record = createEmptyAssetsRecord(productCode);
saveSingleProductAssets(record);

const assets = await ensureProductAssets(productCode, true);
console.log('Assets built:', JSON.stringify(assets, null, 2));
console.log(`Approve when ready: npm run approve:product -- ${productCode}`);
