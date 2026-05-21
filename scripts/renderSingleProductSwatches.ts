#!/usr/bin/env npx tsx
/**
 * Usage:
 *   npm run render:swatches -- TEST-SOFA BALI-SILK
 *   npm run render:swatches -- TEST-SOFA --all
 */
import { resolve } from 'path';
import { listSwatches } from '../src/recolor/swatchRegistry.js';
import { renderProductSwatch } from '../src/recolor/pipeline.js';
import { sourceImagePath } from '../src/recolor/cache.js';

const args = process.argv.slice(2);
const productCode = args[0] ?? 'TEST-SOFA';
let swatches = args.slice(1).filter((a) => !a.startsWith('--'));

if (swatches.includes('--all')) {
  swatches = listSwatches().map((s) => s.code);
}
if (!swatches.length) swatches = ['BALI-SILK'];

const buildSource = resolve(sourceImagePath(productCode));
console.log(`Product: ${productCode}`);
console.log(`Render base source (always): ${buildSource}\n`);

for (const swatchCode of swatches) {
  const result = await renderProductSwatch({ productCode, swatchCode, forceRebuild: true });
  console.log(`\n${swatchCode} complete:`);
  console.log(`  source used:  ${result.sourcePath}`);
  console.log(`  output file:  ${result.outputPath}`);
  console.log(`  public URL:   ${result.imageUrl}`);
}
