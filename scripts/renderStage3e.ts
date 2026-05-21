#!/usr/bin/env npx tsx
/**
 * Stage 3E — lighter/cleaner LAB sweep from locked 3D-J.
 */
import { resolve } from 'path';
import { runStage3e } from '../src/phase3e/run.js';
import { variantSettingsLine } from '../src/phase3e/variants.js';

console.log('Stage 3E: lighter/cleaner sweep from 3D-J (K–N)\n');

const { grid, spec, results } = await runStage3e();

console.log(`  grid: ${resolve(grid)}`);
console.log(`  spec: ${resolve(spec)}\n`);
for (const r of results) {
  console.log(
    `  ${r.variant.id}: meanLabDelta=${r.upholsteryMeanLabDeltaFromSource.toFixed(4)} lStdRatio=${r.lStdPreservationRatio.toFixed(4)}`,
  );
  console.log(`    ${resolve(r.outputPath)}`);
  console.log(`    ${variantSettingsLine(r.variant)}`);
}
