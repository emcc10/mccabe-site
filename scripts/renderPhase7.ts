#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase7 } from '../src/phase7/run.js';

console.log('Phase 7: material model reset (4B-v3 + 6A base, NOT 6C-B)\n');

const out = await runPhase7();

console.log(`  6A base mean L: ${out.baseLab.meanL.toFixed(3)}\n`);

console.log('=== Variants ===');
for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    struct=${v.params.structureStrength} seam=${v.params.seamStrength} micro=${v.params.microStrength}`);
  console.log(`    ΔmeanL vs 6A: ${v.deltaLFrom6a >= 0 ? '+' : ''}${v.deltaLFrom6a.toFixed(3)}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log('\n=== Debug maps ===');
console.log(`  phase7-structure-map.png`);
console.log(`  phase7-seam-map.png`);
console.log(`  phase7-micro-material-map.png`);

console.log(`\n=== Grid ===`);
console.log(`  ${resolve(out.grid)}`);
console.log(`  ${resolve(out.spec)}`);
