#!/usr/bin/env npx tsx
/**
 * Stage 5B — locked realism single render.
 */
import { resolve } from 'path';
import { runStage5b } from '../src/phase5b/run.js';
import { LOCKED_5B } from '../src/phase5b/spec.js';

console.log('Stage 5B: locked realism single render\n');

const out = await runStage5b();
const p = LOCKED_5B;

console.log('=== Locked realism ===');
console.log(`  detailStrength=${p.detailStrength} highlightStrength=${p.highlightStrength}`);
console.log(`  aVariationAmplitude=${p.aVariationAmplitude} bVariationAmplitude=${p.bVariationAmplitude}`);
console.log(`  base=${p.base}\n`);

console.log('=== Outputs ===');
console.log(`  stage5b-single.png`);
console.log(`    ${resolve(out.single)}`);
console.log(`  stage5b-comparison.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  stage5b-spec.json`);
console.log(`    ${resolve(out.spec)}\n`);

console.log('=== Upholstery mean L ===');
console.log(`  base:   ${out.baseLab.meanL.toFixed(3)}`);
console.log(`  output: ${out.outLab.meanL.toFixed(3)}  Δ=${(out.outLab.meanL - out.baseLab.meanL).toFixed(3)}`);
