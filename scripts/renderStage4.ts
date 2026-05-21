#!/usr/bin/env npx tsx
/**
 * Stage 4 — relative L remap + swatch chroma (not Stage 2–3F LAB blend).
 */
import { resolve } from 'path';
import { runStage4 } from '../src/phase4/run.js';

console.log('Stage 4: relative luminance remap + swatch chroma\n');

const { grid, spec, results, sharedStats } = await runStage4();

console.log('=== Source upholstery LAB stats ===');
console.log(JSON.stringify(sharedStats, null, 2));
console.log('');

console.log(`  grid: ${resolve(grid)}`);
console.log(`  spec: ${resolve(spec)}\n`);

for (const r of results) {
  console.log(
    `  ${r.variant.id}: meanLabDelta=${r.upholsteryMeanLabDeltaFromSource.toFixed(4)} lStdRatio=${r.lStdPreservationRatio.toFixed(4)}`,
  );
  console.log(`    ${resolve(r.outputPath)}`);
}
