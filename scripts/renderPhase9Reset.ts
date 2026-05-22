#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase9Reset } from '../src/phase9reset/run.js';

console.log('Phase 9 RESET: clean swatch extraction + stochastic apply\n');

const out = await runPhase9Reset();

console.log('=== Swatch sanitization debug ===');
console.log('  phase9-clean-swatch-base.png');
console.log('  phase9-clean-swatch-grain.png');
console.log('  phase9-clean-swatch-mottle.png');
console.log('  phase9-clean-swatch-color-bias.png');
console.log('  phase9-swatch-artifact-mask.png\n');

console.log('=== Variants ===');
for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    ΔmeanL vs 6A: ${v.deltaLFrom6a >= 0 ? '+' : ''}${v.deltaLFrom6a.toFixed(4)}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n=== Grid ===`);
console.log(`  ${resolve(out.grid)}`);
console.log(`  ${resolve(out.spec)}`);
