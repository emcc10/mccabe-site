#!/usr/bin/env npx tsx
/**
 * Stage 3B — six LAB target variants, same minimal pipeline as Stage 3.
 */
import { resolve } from 'path';
import { runStage3b } from '../src/phase3b/run.js';
import { variantSettingsLine } from '../src/phase3b/variants.js';

console.log('Stage 3B: target endpoint comparison (6 variants)\n');

const { grid, spec, results } = await runStage3b();

console.log('=== Grid ===');
console.log(`  ${resolve(grid)}\n`);
console.log('=== Spec + metrics ===');
console.log(`  ${resolve(spec)}\n`);
console.log('=== Variants ===');
for (const r of results) {
  console.log(
    `  ${r.variant.id}: meanLabDelta=${r.upholsteryMeanLabDeltaFromSource.toFixed(4)} lStdRatio=${r.lStdPreservationRatio.toFixed(4)}`,
  );
  console.log(`    ${resolve(r.outputPath)}`);
  console.log(`    ${variantSettingsLine(r.variant)}`);
}
