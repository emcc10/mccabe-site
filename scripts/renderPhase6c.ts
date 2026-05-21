#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase6c } from '../src/phase6c/run.js';
import { LOCKED_6B_B } from '../src/phase6b/spec.js';

console.log('Phase 6C: realism naturalization (locked 6B-B base)\n');

const out = await runPhase6c();
const b = LOCKED_6B_B;

console.log('=== Locked 6B-B ===');
console.log(`  detail=${b.detailStrength} hi=${b.highlightStrength} a=${b.aVarAmp} b=${b.bVarAmp}`);
console.log(`  fineBlur=${b.fineBlurPx} coarseBlur=${b.coarseBlurPx} seamBoost=${b.seamBoost}\n`);

console.log('=== Variants (vs 6B-B mean L) ===');
for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    fine×${v.params.fineDetailScale} seam=${v.params.seamBoost} irr=${v.params.luminanceIrregularityAmp ?? 0}`);
  console.log(`    ΔmeanL=${v.deltaLFrom6bB >= 0 ? '+' : ''}${v.deltaLFrom6bB.toFixed(3)}`);
  console.log(`    ${resolve(v.path)}`);
}
console.log(`\n  phase6c-grid.png  ${resolve(out.grid)}`);
console.log(`  phase6c-spec.json ${resolve(out.spec)}`);
