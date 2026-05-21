#!/usr/bin/env npx tsx
/**
 * Stage 3F — single render, locked 3E candidate M (not final Bali Silk).
 */
import { resolve } from 'path';
import { runStage3f } from '../src/phase3f/run.js';
import { LOCKED_M } from '../src/phase3f/spec.js';

console.log('Stage 3F: single render (locked 3E-M, not final Bali Silk)\n');

const out = await runStage3f();

console.log('=== Locked constants ===');
console.log(`  L=${LOCKED_M.targetLab.l} a=${LOCKED_M.targetLab.a} b=${LOCKED_M.targetLab.b}`);
console.log(`  preserveLuminance=${LOCKED_M.preserveLuminance}`);
console.log(`  chromaBlend=${LOCKED_M.chromaBlend}\n`);

console.log('=== Outputs ===');
console.log(`  stage3f-single-M.png`);
console.log(`    ${resolve(out.single)}`);
console.log(`  stage3f-comparison-M.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  stage3f-spec.json`);
console.log(`    ${resolve(out.spec)}\n`);

console.log('=== Metrics ===');
console.log(`  upholsteryMeanLabDeltaFromSource: ${out.metrics.upholsteryMeanLabDeltaFromSource.toFixed(4)}`);
console.log(`  lStdPreservationRatio:            ${out.metrics.lStdPreservationRatio.toFixed(4)}`);
console.log(`  legExactMatchRatio:               ${out.metrics.legExactMatchRatio.toFixed(6)}`);
