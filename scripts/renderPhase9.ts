#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase9 } from '../src/phase9/run.js';

console.log('Phase 9: swatch-derived material transfer (4B-v3 + 6A base)\n');

const out = await runPhase9();

console.log(`  6A base mean L: ${out.baseLab.meanL.toFixed(3)}\n`);

console.log('=== Variants ===');
for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    ΔmeanL vs 6A: ${v.deltaLFrom6a >= 0 ? '+' : ''}${v.deltaLFrom6a.toFixed(4)}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log('\n=== Swatch maps (from Bali-Silk.jpg patch) ===');
console.log('  phase9-swatch-grain-map.png');
console.log('  phase9-swatch-mottle-map.png');
console.log('  phase9-swatch-color-bias-map.png');

console.log(`\n=== Grid ===`);
console.log(`  ${resolve(out.grid)}`);
console.log(`  ${resolve(out.spec)}`);
