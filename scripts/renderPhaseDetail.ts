#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseDetail } from '../src/phaseDetail/run.js';
import { VISIBLE_THRESHOLD } from '../src/phaseDetail/spec.js';

console.log('Phase Detail: band-pass swatch detail transfer (NOT Phase 9/10 stochastic)\n');
console.log(`  Visible threshold: mean |ΔL| ≥ ${VISIBLE_THRESHOLD.minMeanAbsDeltaL}, SSIM(L) < ${VISIBLE_THRESHOLD.maxSsimL}\n`);

const out = await runPhaseDetail();

for (const v of out.variants) {
  console.log(`  ${v.label}`);
  console.log(`    calibrated strength: ${v.calibratedStrength.toFixed(3)}`);
  console.log(`    vs 6A mean |ΔL|: ${v.validationVs6a.meanAbsDeltaL.toFixed(3)}`);
  console.log(`    vs 6A SSIM(L): ${v.validationVs6a.ssimOnL.toFixed(4)}`);
  console.log(`    ${v.validationVs6a.verdict}`);
  console.log(`    ${resolve(v.path)}`);
}

console.log(`\n  any passes threshold: ${out.variants.some((v) => v.validationVs6a.passesVisibleThreshold)}`);
console.log(`  ${resolve(out.grid)}`);
console.log(`  ${resolve(out.spec)}`);
