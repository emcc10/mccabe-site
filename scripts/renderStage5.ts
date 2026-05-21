#!/usr/bin/env npx tsx
/**
 * Stage 5 — realism pass on locked Stage 4B-v3 base.
 */
import { resolve } from 'path';
import { runStage5 } from '../src/phase5/run.js';

console.log('Stage 5: realism pass on Stage 4B-v3 base\n');

const out = await runStage5();

console.log('=== Base ===');
console.log('  Stage 4B-v3 (color + edges locked)\n');

console.log('=== Variants ===');
for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    detailStrength=${v.detailStrength}  ΔmeanL=${v.deltaLFromBase >= 0 ? '+' : ''}${v.deltaLFromBase.toFixed(3)}`);
  console.log(`    ${resolve(v.path)}`);
}
console.log('');

console.log('=== Outputs ===');
console.log(`  stage5-grid.png`);
console.log(`    ${resolve(out.grid)}`);
console.log(`  stage5-spec.json`);
console.log(`    ${resolve(out.spec)}`);
