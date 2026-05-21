#!/usr/bin/env npx tsx
/**
 * Stage 2 proof only (Phase 1 masks + Stage 2 recolor). Does NOT run Stage 3.
 */
import { resolve } from 'path';
import { runPhase1 } from '../src/phase1/run.js';
import { COMBINED_OVERLAY_PREVIEW } from '../src/phase1/paths.js';
import { runPhase2 } from '../src/phase2/run.js';
import { stage2SpecRecord } from '../src/phase2/spec.js';

console.log('Stage 2 proof only (Stage 3: npm run render:stage3)\n');

await runPhase1();
const p2 = await runPhase2();
const spec = stage2SpecRecord();

console.log('=== Stage 2 constants ===');
console.log(`  preserveLuminance:         ${spec.preserveLuminance}`);
console.log(`  chromaBlend:               ${spec.chromaBlend}`);
console.log(`  targetLab:                 L=${spec.targetLab.l} a=${spec.targetLab.a} b=${spec.targetLab.b}`);
console.log(`  textureDetailContribution: ${spec.textureDetailContribution}`);
console.log(`  highlightCompression:      ${spec.highlightCompression}`);
console.log(`  postRgbPasses:             ${JSON.stringify(spec.postRgbPasses)}\n`);

console.log('=== Recolor formula ===');
console.log(spec.recolorFormula);
console.log('');

console.log('=== Output files ===');
console.log(`  combined-overlay-preview.png`);
console.log(`    ${resolve(COMBINED_OVERLAY_PREVIEW)}`);
console.log(`  phase2-bali-silk.png`);
console.log(`    ${resolve(p2.recolor)}`);
console.log(`  phase2-comparison.png`);
console.log(`    ${resolve(p2.comparison)}`);
console.log(`  stage2-spec.json`);
console.log(`    ${resolve(p2.spec)}`);
console.log(`  stage2-structural-metrics.json`);
console.log(`    ${resolve(p2.metrics)}\n`);

console.log('=== Metrics ===');
console.log(`  upholsteryMeanLabDeltaFromSource: ${p2.structural.upholsteryMeanLabDeltaFromSource.toFixed(4)}`);
console.log(`  upholsteryMeanAbsDeltaRgb:        ${p2.structural.upholsteryMeanAbsDeltaRgb.toFixed(4)}`);
console.log(`  lStdPreservationRatio:            ${p2.structural.lStdPreservationRatio.toFixed(4)}`);
console.log(`  legExactMatchRatio:               ${p2.structural.legExactMatchRatio.toFixed(6)}`);
console.log(`  structurallyCorrect:            ${p2.structural.structurallyCorrect}`);
if (p2.structural.failReasons.length) {
  console.log('  failReasons:');
  for (const r of p2.structural.failReasons) console.log(`    - ${r}`);
}

console.log('\nNext (explicit): npm run render:stage3');
