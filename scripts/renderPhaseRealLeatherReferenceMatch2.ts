#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseRealLeatherReferenceMatch2 } from '../src/phaseRealLeatherReferenceMatch2/run.js';

console.log('Phase RealLeather Reference Match 2: softer highlight clamp on top of REF-B\n');

const out = await runPhaseRealLeatherReferenceMatch2();

for (const v of out.results) {
  console.log(`  ${v.label}`);
  console.log(`    vs REF-B mean |ΔL|: ${v.vsRefB.meanAbsDeltaL.toFixed(3)}`);
  console.log(`    vs REALLEATHER2-B mean |ΔL|: ${v.vsRealLeather2B.meanAbsDeltaL.toFixed(3)} SSIM(L): ${v.vsRealLeather2B.ssimOnL.toFixed(4)}`);
  console.log(`    mean L: ${v.meanLab.meanL.toFixed(3)}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n  compare: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
