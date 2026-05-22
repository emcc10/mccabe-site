#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase7c } from '../src/phase7c/run.js';

console.log('Phase 7C: upper upholstery texture recovery (7B base + regional boost)\n');

const out = await runPhase7c();

console.log('=== Upper region mask ===');
console.log(`  hard upper px: ${out.upperRegion.definition.zones.length ? 'see spec' : 'n/a'}`);
console.log(`  ${resolve(out.upperMask)}\n`);

console.log('=== Variants (7B global + upper-only delta) ===');
for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    +micro=${v.boost.extraMicro} +struct=${v.boost.extraStructure}`);
  console.log(`    ΔmeanL vs 6A: ${v.deltaLFrom6a >= 0 ? '+' : ''}${v.deltaLFrom6a.toFixed(4)}`);
  console.log(`    ΔmeanL vs 7B: ${v.deltaLFrom7b >= 0 ? '+' : ''}${v.deltaLFrom7b.toFixed(4)}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n=== Grid ===`);
console.log(`  ${resolve(out.grid)}`);
console.log(`  ${resolve(out.spec)}`);
