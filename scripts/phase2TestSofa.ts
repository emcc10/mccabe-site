#!/usr/bin/env npx tsx
/**
 * Phase 2 — minimal Bali Silk recolor (after Phase 1 masks approved).
 *
 * Usage:
 *   npm run phase1:test-sofa
 *   npm run phase2:test-sofa
 */
import { resolve } from 'path';
import { runPhase2 } from '../src/phase2/run.js';

console.log('Phase 2: minimal upholstery recolor (Bali Silk)\n');

const out = await runPhase2();

console.log('Files created:\n');
console.log(`  phase2-bali-silk.png`);
console.log(`    ${resolve(out.recolor)}\n`);
console.log(`  phase2-comparison.png (source | mask overlay | recolor)`);
console.log(`    ${resolve(out.comparison)}\n`);
