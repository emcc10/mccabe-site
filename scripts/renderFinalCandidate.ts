#!/usr/bin/env npx tsx
/**
 * Final Bali Silk candidate — locked Stage 5C-C on Stage 5B / 4B-v3 base.
 */
import { resolve } from 'path';
import { runFinalBaliSilkCandidate } from '../src/final/run.js';
import { LOCKED_5C_C } from '../src/phase5c/spec.js';

console.log('Final Bali Silk candidate (Stage 5C-C locked)\n');

const out = await runFinalBaliSilkCandidate();
const p = LOCKED_5C_C;

console.log('=== Locked refinement (5C-C) ===');
console.log(`  detailStrength=${p.detailStrength} highlightStrength=${p.highlightStrength}`);
console.log(`  aVarAmp=${p.aVariationAmplitude} bVarAmp=${p.bVariationAmplitude}`);
console.log(`  base=${p.base}\n`);

console.log('=== Outputs ===');
console.log(`  final-bali-silk-candidate.png`);
console.log(`    ${resolve(out.candidate)}`);
console.log(`  final-bali-silk-comparison.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  final-bali-silk-spec.json`);
console.log(`    ${resolve(out.spec)}\n`);

console.log('=== Upholstery mean L ===');
console.log(`  5B:    ${out.stage5bLab.meanL.toFixed(3)}`);
console.log(`  final: ${out.finalLab.meanL.toFixed(3)}  Δ=${(out.finalLab.meanL - out.stage5bLab.meanL).toFixed(3)}`);
