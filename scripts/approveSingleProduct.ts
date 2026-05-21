#!/usr/bin/env npx tsx
/**
 * Usage: npm run approve:product -- TEST-SOFA
 */
import { loadSingleProductAssets, saveSingleProductAssets } from '../src/recolor/productAssets.js';

const productCode = process.argv[2] ?? 'TEST-SOFA';
const assets = loadSingleProductAssets(productCode);
if (!assets) {
  console.error(`No assets.json for ${productCode}. Run build:assets first.`);
  process.exit(1);
}
assets.segmentationApproved = true;
saveSingleProductAssets(assets);
console.log(`Approved segmentation for ${productCode} at ${assets.updatedAt}`);
