#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase95 } from '../src/phase95/run.js';

const out = await runPhase95();

console.log('Phase 9.5 — prove or fail (7C-B vs 9RESET-B)\n');
console.log(`  Verdict: ${out.verdict}`);
console.log(`  Visually meaningful: ${out.visuallyMeaningful}`);
console.log(`  Mean |ΔL| upholstery: ${out.upholsteryDelta.meanAbsDeltaL.toFixed(3)}`);
console.log(`  Mean |ΔRGB| upholstery: ${out.upholsteryDelta.meanAbsDeltaRgb.toFixed(3)}`);
console.log(`  Max |ΔL|: ${out.upholsteryDelta.maxAbsDeltaL.toFixed(3)}`);
console.log(`  SSIM (L): ${out.upholsteryDelta.ssimOnL.toFixed(6)}`);
console.log(`  Pixels ΔL≥2: ${(out.upholsteryDelta.fractionAboveLThreshold2 * 100).toFixed(2)}%`);
console.log(`\n  ${resolve(out.outputs.diff)}`);
console.log(`  ${resolve(out.outputs.heatmap)}`);
console.log(`  ${resolve(out.outputs.metrics)}`);
