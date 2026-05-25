#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseRealLeather2 } from '../src/phaseRealLeather2/run.js';

console.log('Phase RealLeather 2: stronger satin leather from RealLeather-B\n');

const out = await runPhaseRealLeather2();

for (const v of out.results) {
  console.log(`  ${v.label}`);
  console.log(`    vs 6A mean |ΔL|: ${v.vs6a.meanAbsDeltaL.toFixed(3)} SSIM(L): ${v.vs6a.ssimOnL.toFixed(4)}`);
  console.log(`    vs REALLEATHER-B mean |ΔL|: ${v.vsRealLeatherB.meanAbsDeltaL.toFixed(3)}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n  compare: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
