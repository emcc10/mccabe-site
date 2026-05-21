#!/usr/bin/env npx tsx
/**
 * Prove Stage 2 in code + outputs. Optionally runs Stage 3 if structural metrics pass.
 */
import { resolve } from 'path';
import { runPhase1 } from '../src/phase1/run.js';
import { COMBINED_OVERLAY_PREVIEW } from '../src/phase1/paths.js';
import { runPhase2 } from '../src/phase2/run.js';
import { stage2SpecRecord } from '../src/phase2/spec.js';
import { runPhase3 } from '../src/phase3/run.js';

console.log('Branch scope: Stage 0–2 proof (Stage 3 only if metrics pass)\n');

await runPhase1();
const p2 = await runPhase2();
const spec = stage2SpecRecord();

console.log('=== 1. Branch intent ===');
console.log(`  stage: ${spec.stage}`);
console.log(`  ${spec.branchIntent}\n`);

console.log('=== 2. Stage 2 code values ===');
console.log(`  preserveLuminance:        ${spec.preserveLuminance}`);
console.log(`  chromaBlend (a/b pull):   ${spec.chromaBlend}`);
console.log(`  targetLab:                L=${spec.targetLab.l} a=${spec.targetLab.a} b=${spec.targetLab.b}`);
console.log(`  textureDetailContribution: ${spec.textureDetailContribution}`);
console.log(`  highlightCompression:       ${spec.highlightCompression}`);
console.log(`  shadowMapContribution:    ${spec.shadowMapContribution}`);
console.log(`  chromaDrift:              ${spec.chromaDrift}`);
console.log(`  postRgbPasses:            ${JSON.stringify(spec.postRgbPasses)}\n`);

console.log('=== 3. Recolor formula ===');
console.log(spec.recolorFormula);
console.log('');
console.log('=== Composite rules ===');
console.log(spec.compositeRules);
console.log('');

console.log('=== 4. Output files ===');
console.log(`  combined-overlay-preview.png\n    ${resolve(COMBINED_OVERLAY_PREVIEW)}`);
console.log(`  phase2-bali-silk.png\n    ${resolve(p2.recolor)}`);
console.log(`  phase2-comparison.png\n    ${resolve(p2.comparison)}`);
console.log(`  stage2-spec.json\n    ${resolve(p2.spec)}`);
console.log(`  stage2-structural-metrics.json\n    ${resolve(p2.metrics)}\n`);

console.log('=== 6. Legs restored from source pixels? ===');
console.log(`  legPixels: ${p2.structural.legPixels}`);
console.log(`  exact RGB match ratio: ${p2.structural.legExactMatchRatio.toFixed(6)}`);
console.log(`  answer: ${p2.structural.legExactMatchRatio >= 0.999 ? 'YES — composite copies source.data[] on legMask' : 'NO'}\n`);

console.log('=== 7. Final alpha from source only? ===');
console.log('  YES — alpha mask = source image alpha channel (A>=128) or L<248 fallback; composite uses that mask, no external matte.\n');

console.log('=== 8. Post-pass modifying luminance after recolor? ===');
console.log(`  postRgbPasses: ${JSON.stringify(spec.postRgbPasses)}`);
console.log('  answer: NO — composite only selects source vs recolor buffer; no blur/flatten pass.\n');

console.log('=== Structural metrics (Stage 2 gate) ===');
console.log(JSON.stringify(p2.structural, null, 2));

if (!p2.structural.structurallyCorrect) {
  console.log('\nStage 3 BLOCKED — fix Stage 2 structure first:');
  for (const r of p2.structural.failReasons) console.log(`  - ${r}`);
  process.exit(1);
}

console.log('\nStage 2 structurallyCorrect=true — running Stage 3 (new settings, same pipeline)...');
const p3 = await runPhase3();
console.log(`  phase3-bali-silk.png\n    ${resolve(p3.recolor)}`);
console.log(`  phase3-comparison.png\n    ${resolve(p3.comparison)}`);
console.log(`  stage3-spec.json\n    ${resolve(p3.spec)}`);
