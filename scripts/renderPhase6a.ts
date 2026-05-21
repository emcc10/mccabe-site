#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase6a } from '../src/phase6a/run.js';

console.log('Phase 6A: bottom-front seam cleanup\n');
const out = await runPhase6a();
const d = out.diagnostics;

console.log('=== Seam diagnostics ===');
console.log(`  cleanup band pixels:     ${d.cleanupBandPixelCount}`);
console.log(`  overlap edge band:       ${d.overlapEdgeBandPx}`);
console.log(`  overlap contour ring:    ${d.overlapContourRingPx}`);
console.log(`  outside core upholstery: ${d.overlapOutsideCoreUpholsteryPx}`);
console.log(`  background touched:      ${d.backgroundPixelsTouched}`);
console.log(`  mean L band before/after: ${d.meanLInBandBefore.toFixed(2)} → ${d.meanLInBandAfter.toFixed(2)}\n`);

console.log('=== Outputs ===');
console.log(`  phase6a-bottomline-debug.png`);
console.log(`  phase6a-single.png          ${resolve(out.single)}`);
console.log(`  phase6a-comparison.png      ${resolve(out.comparison)}`);
