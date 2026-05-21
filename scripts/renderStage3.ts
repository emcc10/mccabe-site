#!/usr/bin/env npx tsx
/**
 * Stage 3 swatch match only — same pipeline as Stage 2, stronger constants.
 * Requires Phase 1 outputs (source.png + leg-mask.override.png).
 */
import { resolve } from 'path';
import { runPhase3 } from '../src/phase3/run.js';
import { stage3SpecRecord } from '../src/phase3/spec.js';

console.log('Stage 3 swatch match (minimal LAB recolor)\n');

const out = await runPhase3();
const spec = stage3SpecRecord();

console.log('=== Stage 3 constants ===');
console.log(`  preserveLuminance:         ${spec.preserveLuminance}`);
console.log(`  chromaBlend:               ${spec.chromaBlend}`);
console.log(`  targetLab:                 L=${spec.targetLab.l} a=${spec.targetLab.a} b=${spec.targetLab.b}`);
console.log(`  textureDetailContribution: ${spec.textureDetailContribution}`);
console.log(`  highlightCompression:      ${spec.highlightCompression}`);
console.log(`  postRgbPasses:             ${JSON.stringify(spec.postRgbPasses)}\n`);

console.log('=== Output files ===');
console.log(`  phase3-bali-silk.png`);
console.log(`    ${resolve(out.recolor)}`);
console.log(`  phase3-comparison.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  stage3-spec.json`);
console.log(`    ${resolve(out.spec)}`);
console.log(`  stage3-metrics.json`);
console.log(`    ${resolve(out.metrics)}\n`);

console.log('=== Metrics ===');
console.log(`  upholsteryMeanLabDeltaFromSource: ${out.metricsData.upholsteryMeanLabDeltaFromSource.toFixed(4)}`);
console.log(`  upholsteryMeanAbsDeltaRgb:        ${out.metricsData.upholsteryMeanAbsDeltaRgb.toFixed(4)}`);
console.log(`  lStdPreservationRatio:            ${out.metricsData.lStdPreservationRatio.toFixed(4)}`);
console.log(`  legExactMatchRatio:               ${out.metricsData.legExactMatchRatio.toFixed(6)}`);
