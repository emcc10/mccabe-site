#!/usr/bin/env npx tsx
/**
 * Stage 5C — micro-refinement variants on locked Stage 5B base.
 */
import { resolve } from 'path';
import { runStage5c } from '../src/phase5c/run.js';

console.log('Stage 5C: micro-refinement on Stage 5B base\n');

const out = await runStage5c();

console.log('=== Locked baseline (5B) ===');
console.log(`  upholstery mean L: ${out.stage5bLab.meanL.toFixed(3)}\n`);

console.log('=== Variants (delta from 5B) ===');
for (const v of out.variants) {
  const d = v.deltaFrom5b;
  console.log(`  ${v.label}  detail=${v.params.detailStrength} hi=${v.params.highlightStrength}`);
  console.log(`    Δ5B: detail+${d.detailStrength} hi+${d.highlightStrength} a+${d.aVarAmp} b+${d.bVarAmp}`);
  console.log(`    ΔmeanL=${v.deltaLFrom5b >= 0 ? '+' : ''}${v.deltaLFrom5b.toFixed(3)}`);
  console.log(`    ${resolve(v.path)}`);
}
console.log('');

console.log('=== Outputs ===');
console.log(`  stage5c-grid.png`);
console.log(`    ${resolve(out.grid)}`);
console.log(`  stage5c-spec.json`);
console.log(`    ${resolve(out.spec)}`);
