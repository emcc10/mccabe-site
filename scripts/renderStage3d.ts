#!/usr/bin/env npx tsx
/**
 * Stage 3D — single render, locked 3C candidate J (not final Bali Silk).
 */
import { resolve } from 'path';
import { runStage3d } from '../src/phase3d/run.js';
import { LOCKED_J } from '../src/phase3d/spec.js';

console.log('Stage 3D: single render (locked 3C-J, not final Bali Silk)\n');

const out = await runStage3d();

console.log('=== Locked constants ===');
console.log(`  L=${LOCKED_J.targetLab.l} a=${LOCKED_J.targetLab.a} b=${LOCKED_J.targetLab.b}`);
console.log(`  preserveLuminance=${LOCKED_J.preserveLuminance}`);
console.log(`  chromaBlend=${LOCKED_J.chromaBlend}\n`);

console.log('=== Outputs ===');
console.log(`  stage3d-single-J.png`);
console.log(`    ${resolve(out.single)}`);
console.log(`  stage3d-comparison-J.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  stage3d-spec.json`);
console.log(`    ${resolve(out.spec)}\n`);

console.log('=== Metrics ===');
console.log(`  upholsteryMeanLabDeltaFromSource: ${out.metrics.upholsteryMeanLabDeltaFromSource.toFixed(4)}`);
console.log(`  lStdPreservationRatio:            ${out.metrics.lStdPreservationRatio.toFixed(4)}`);
console.log(`  legExactMatchRatio:               ${out.metrics.legExactMatchRatio.toFixed(6)}`);
