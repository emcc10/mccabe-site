#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseRealLeatherReferenceMatch } from '../src/phaseRealLeather3/run.js';

console.log('Phase RealLeather Reference Match: reference-driven tonal/material behavior\n');

const out = await runPhaseRealLeatherReferenceMatch();

for (const v of out.results) {
  console.log(`  ${v.label}`);
  console.log(`    vs 6A mean |ΔL|: ${v.vs6a.meanAbsDeltaL.toFixed(3)} SSIM(L): ${v.vs6a.ssimOnL.toFixed(4)}`);
  console.log(`    vs REALLEATHER2-B mean |ΔL|: ${v.vsRealLeather2B.meanAbsDeltaL.toFixed(3)}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n  compare: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
