#!/usr/bin/env npx tsx
/**
 * Stage 3C — lower preserveL sweep from 3B candidate F.
 */
import { resolve } from 'path';
import { runStage3c } from '../src/phase3c/run.js';
import { variantSettingsLine } from '../src/phase3c/variants.js';

console.log('Stage 3C: preserveL reduction (F baseline, variants G–J)\n');

const { grid, spec, results } = await runStage3c();

console.log('=== Grid ===');
console.log(`  ${resolve(grid)}\n`);
console.log('=== Spec ===');
console.log(`  ${resolve(spec)}\n`);
console.log('=== Variants (3B-F locked as reference, not final Bali Silk) ===');
for (const r of results) {
  console.log(
    `  ${r.variant.id}: meanLabDelta=${r.upholsteryMeanLabDeltaFromSource.toFixed(4)} lStdRatio=${r.lStdPreservationRatio.toFixed(4)}`,
  );
  console.log(`    ${resolve(r.outputPath)}`);
  console.log(`    ${variantSettingsLine(r.variant)}`);
}
