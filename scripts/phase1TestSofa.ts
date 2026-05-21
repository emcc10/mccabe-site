#!/usr/bin/env npx tsx
/**
 * Phase 1 — TEST-SOFA segmentation previews only.
 * No recolor. No swatch render. No maps/realism.
 *
 * Usage: npm run phase1:test-sofa
 */
import { resolve } from 'path';
import { runPhase1 } from '../src/phase1/run.js';

console.log('Phase 1: TEST-SOFA segmentation previews\n');

const out = await runPhase1();

console.log('Files created:\n');
for (const [label, path] of [
  ['source.png', out.source],
  ['alpha-preview.png', out.alphaPreview],
  ['upholstery-mask-preview.png', out.upholsteryMaskPreview],
  ['leg-mask-preview.png', out.legMaskPreview],
  ['combined-overlay-preview.png', out.combinedOverlayPreview],
]) {
  console.log(`  ${label}`);
  console.log(`    ${resolve(path)}\n`);
}

console.log('Review combined-overlay-preview.png by eye before any Phase 2 work.');
