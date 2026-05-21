#!/usr/bin/env npx tsx
/**
 * Usage:
 *   npm run render:swatches -- TEST-SOFA BALI-SILK REIN-GREY
 *   npm run render:swatches -- TEST-SOFA --all
 */
import { listSwatches } from '../src/recolor/swatchRegistry.js';
import { renderProductSwatch } from '../src/recolor/pipeline.js';

const args = process.argv.slice(2);
const productCode = args[0] ?? 'TEST-SOFA';
let swatches = args.slice(1).filter((a) => !a.startsWith('--'));

if (swatches.includes('--all')) {
  swatches = listSwatches().map((s) => s.code);
}
if (!swatches.length) swatches = ['BALI-SILK'];

console.log(`Rendering ${productCode}: ${swatches.join(', ')}`);

for (const swatchCode of swatches) {
  const result = await renderProductSwatch({ productCode, swatchCode });
  console.log(`${swatchCode} → ${result.imageUrl} (cache ${result.cacheKey})`);
}
