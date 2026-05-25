#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseDetail3 } from '../src/phaseDetail3/run.js';

console.log('Phase Detail 3: fine-grain dominant (DETAIL2-A base)\n');

const out = await runPhaseDetail3();

for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    strength: ${v.calibratedStrength.toFixed(3)}`);
  console.log(`    vs 6A mean |ΔL|: ${v.vs6a.meanAbsDeltaL.toFixed(3)} SSIM(L): ${v.vs6a.ssimOnL.toFixed(4)}`);
  if (v.vsDetail2A) {
    console.log(`    vs DETAIL2-A mean |ΔL|: ${v.vsDetail2A.meanAbsDeltaL.toFixed(3)}`);
  }
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n  compare: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
