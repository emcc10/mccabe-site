#!/usr/bin/env npx tsx
/**
 * Stage 4B — edge-fixed v3 (thin contour rings, not final Bali Silk).
 */
import { resolve } from 'path';
import { runStage4b } from '../src/phase4b/run.js';
import { LOCKED_4B } from '../src/phase4b/spec.js';

console.log('Stage 4B: edge-fixed v3 (thin contour rings, not final Bali Silk)\n');

const out = await runStage4b();
const p = LOCKED_4B;
const a = out.audit;

console.log('=== Locked settings ===');
console.log(`  L_low=${p.lLow} L_high=${p.lHigh} mappedLBlend=${p.mappedLBlend}`);
console.log(`  targetA=${p.targetA} targetB=${p.targetB}`);
console.log(`  chromaSourceA=${p.chromaSourceA} chromaSourceB=${p.chromaSourceB}`);
console.log(`  chromaTargetA=${p.chromaTargetA} chromaTargetB=${p.chromaTargetB}\n`);

console.log('=== Coverage audit (all must be 0) ===');
console.log(`  bandSourceRgbSurvivors:                  ${a.bandSourceRgbSurvivors}`);
console.log(`  cornerSourceRgbSurvivors:                ${a.cornerSourceRgbSurvivors}`);
console.log(`  contourSourceRgbSurvivors:               ${a.contourSourceRgbSurvivors}`);
console.log(`  backgroundPixelsTouchedByCleanup:        ${a.backgroundPixelsTouchedByCleanup}`);
console.log(`  footCornerPixelsTouchedOutsideAlpha:     ${a.footCornerPixelsTouchedOutsideAlpha}`);
console.log(`  contourPixelsTouchedOutsideAlpha:        ${a.contourPixelsTouchedOutsideAlpha}\n`);

console.log('=== Outputs ===');
console.log(`  stage4b-single-edgefixed-v3.png`);
console.log(`    ${resolve(out.single)}`);
console.log(`  stage4b-comparison-edgefixed-v3.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  stage4b-corner-ring-preview.png`);
console.log(`  stage4b-contour-ring-preview.png`);
console.log(`  stage4b-spec-edgefixed-v3.json`);
console.log(`    ${resolve(out.spec)}\n`);

console.log('=== Metrics ===');
console.log(`  upholsteryMeanLabDeltaFromSource: ${out.metrics.upholsteryMeanLabDeltaFromSource.toFixed(4)}`);
console.log(`  lStdPreservationRatio:            ${out.metrics.lStdPreservationRatio.toFixed(4)}`);
console.log(`  legExactMatchRatio:               ${out.metrics.legExactMatchRatio.toFixed(6)}`);
