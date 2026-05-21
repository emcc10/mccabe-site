#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase6b } from '../src/phase6b/run.js';

console.log('Phase 6B: material realism v2 (on Phase 6A base)\n');
const out = await runPhase6b();

console.log(`  6A base mean L: ${out.baseLab.meanL.toFixed(3)}\n`);
console.log('=== Variants ===');
for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    ΔmeanL vs 6A: ${v.deltaLFrom6a >= 0 ? '+' : ''}${v.deltaLFrom6a.toFixed(3)}`);
  console.log(`    ${resolve(v.path)}`);
}
console.log(`\n  phase6b-grid.png  ${resolve(out.grid)}`);
console.log(`  phase6b-spec.json ${resolve(out.spec)}`);
