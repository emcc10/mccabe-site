#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseDetail2 } from '../src/phaseDetail2/run.js';

console.log('Phase Detail 2: softer grain, midtone-only, anti-emboss\n');

const out = await runPhaseDetail2();

for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    strength: ${v.calibratedStrength.toFixed(3)}`);
  console.log(`    vs 6A mean |ΔL|: ${v.vs6a.meanAbsDeltaL.toFixed(3)} SSIM(L): ${v.vs6a.ssimOnL.toFixed(4)}`);
  console.log(`    vs DETAIL-A mean |ΔL|: ${v.vsDetailA.meanAbsDeltaL.toFixed(3)}`);
  console.log(`    less flat than 6A: ${v.vs6a.lessFlatThan6a}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n  compare grid: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
