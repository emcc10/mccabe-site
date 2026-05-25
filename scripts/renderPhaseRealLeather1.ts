#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseRealLeather1 } from '../src/phaseRealLeather1/run.js';

console.log('Phase RealLeather 1: smooth leather finish from 6A\n');

const out = await runPhaseRealLeather1();

for (const v of out.results) {
  console.log(`  ${v.label}`);
  console.log(`    vs 6A mean |ΔL|: ${v.vs6a.meanAbsDeltaL.toFixed(3)} SSIM(L): ${v.vs6a.ssimOnL.toFixed(4)}`);
  if (v.vsDetail3A) {
    console.log(`    vs DETAIL3-A mean |ΔL|: ${v.vsDetail3A.meanAbsDeltaL.toFixed(3)}`);
  }
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n  compare: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
