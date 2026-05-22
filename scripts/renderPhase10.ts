#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase10 } from '../src/phase10/run.js';

console.log('Phase 10: stronger open-field swatch transfer\n');

const out = await runPhase10();

for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    vs 9RESET-B mean |ΔL|: ${v.deltaVs9resetB.meanAbsDeltaL.toFixed(3)}`);
  console.log(`    vs 9RESET-B max |ΔL|: ${v.deltaVs9resetB.maxAbsDeltaL.toFixed(3)}`);
  console.log(`    meaningful: ${v.deltaVs9resetB.visuallyMeaningful} — ${v.deltaVs9resetB.verdict}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n  ${resolve(out.grid)}`);
console.log(`  ${resolve(out.spec)}`);
