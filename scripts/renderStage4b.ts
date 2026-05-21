#!/usr/bin/env npx tsx
/**
 * Stage 4B — single render, locked relative L remap (not final Bali Silk).
 */
import { resolve } from 'path';
import { runStage4b } from '../src/phase4b/run.js';
import { LOCKED_4B } from '../src/phase4b/spec.js';

console.log('Stage 4B: edge-fixed single render (relative L remap, not final Bali Silk)\n');

const out = await runStage4b();
const p = LOCKED_4B;

console.log('=== Locked settings ===');
console.log(`  L_low=${p.lLow} L_high=${p.lHigh} mappedLBlend=${p.mappedLBlend}`);
console.log(`  targetA=${p.targetA} targetB=${p.targetB}`);
console.log(`  chromaSourceA=${p.chromaSourceA} chromaSourceB=${p.chromaSourceB}`);
console.log(`  chromaTargetA=${p.chromaTargetA} chromaTargetB=${p.chromaTargetB}\n`);

console.log('=== Coverage audit ===');
console.log(`  leakage (alpha on, non-leg, outside upholstery) before: ${out.leakageBefore}`);
console.log(`  leakage after edge/foot bands:                      ${out.leakageAfter}\n`);

console.log('=== Outputs ===');
console.log(`  stage4b-single-edgefixed.png`);
console.log(`    ${resolve(out.single)}`);
console.log(`  stage4b-comparison-edgefixed.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  stage4b-edgeband-preview.png`);
console.log(`  stage4b-foot-ring-preview.png`);
console.log(`  stage4b-spec-edgefixed.json`);
console.log(`    ${resolve(out.spec)}\n`);

console.log('=== Metrics ===');
console.log(`  upholsteryMeanLabDeltaFromSource: ${out.metrics.upholsteryMeanLabDeltaFromSource.toFixed(4)}`);
console.log(`  lStdPreservationRatio:            ${out.metrics.lStdPreservationRatio.toFixed(4)}`);
console.log(`  legExactMatchRatio:               ${out.metrics.legExactMatchRatio.toFixed(6)}`);
