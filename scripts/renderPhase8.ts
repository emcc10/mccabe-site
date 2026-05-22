#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase8 } from '../src/phase8/run.js';

console.log('Phase 8: frequency-separated material recovery (4B-v3 + 6A base)\n');

const out = await runPhase8();

console.log(`  6A base mean L: ${out.baseLab.meanL.toFixed(3)}\n`);

console.log('=== Variants ===');
for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    mid=${v.params.midStrength} high=${v.params.highStrength}`);
  console.log(`    ΔmeanL vs 6A: ${v.deltaLFrom6a >= 0 ? '+' : ''}${v.deltaLFrom6a.toFixed(4)}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log('\n=== Layer debug maps ===');
console.log('  phase8-low-layer.png');
console.log('  phase8-mid-layer.png');
console.log('  phase8-high-layer.png');
console.log('  phase8-high-confidence-mask.png');

console.log(`\n=== Grid ===`);
console.log(`  ${resolve(out.grid)}`);
console.log(`  ${resolve(out.spec)}`);
