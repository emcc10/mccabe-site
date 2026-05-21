#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase6cSingleB } from '../src/phase6c/runSingleB.js';
import { LOCKED_6C_B_PARAMS } from '../src/phase6c/spec.js';

console.log('Phase 6C-B: locked single render (not final Bali Silk)\n');

const out = await runPhase6cSingleB();
const p = LOCKED_6C_B_PARAMS;

console.log('=== Locked 6C-B ===');
console.log(`  detail=${p.detailStrength} hi=${p.highlightStrength} a=${p.aVarAmp} b=${p.bVarAmp}`);
console.log(`  fineBlur=${p.fineBlurPx} coarseBlur=${p.coarseBlurPx}`);
console.log(`  seamBoost=${p.seamBoost} fineScale=${p.fineDetailScale} irr=${p.luminanceIrregularityAmp ?? 0}\n`);

console.log('=== Outputs ===');
console.log(`  phase6c-single-B.png`);
console.log(`    ${resolve(out.single)}`);
console.log(`  phase6c-comparison-B.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  phase6c-spec-single-B.json`);
console.log(`    ${resolve(out.spec)}\n`);

console.log('=== Upholstery mean L ===');
console.log(`  6A base: ${out.base6aLab.meanL.toFixed(3)}`);
console.log(`  6C-B:    ${out.outLab.meanL.toFixed(3)}  Δ=${(out.outLab.meanL - out.base6aLab.meanL).toFixed(3)}`);
