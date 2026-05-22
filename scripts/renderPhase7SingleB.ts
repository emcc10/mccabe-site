#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase7SingleB } from '../src/phase7/runSingleB.js';
import { LOCKED_7B_PARAMS } from '../src/phase7/spec.js';

console.log('Phase 7-B: locked single render (not final Bali Silk)\n');

const out = await runPhase7SingleB();
const p = LOCKED_7B_PARAMS;

console.log('=== Locked 7B material model ===');
console.log(`  structure=${p.structureStrength} seam=${p.seamStrength}`);
console.log(`  micro=${p.microStrength} highlight=${p.highlightStrength}\n`);

console.log('=== Outputs ===');
console.log(`  phase7-single-B.png`);
console.log(`    ${resolve(out.single)}`);
console.log(`  phase7-comparison-B.png`);
console.log(`    ${resolve(out.comparison)}`);
console.log(`  phase7-spec-single-B.json`);
console.log(`    ${resolve(out.spec)}\n`);

console.log('=== Upholstery mean L ===');
console.log(`  6A base: ${out.base6aLab.meanL.toFixed(3)}`);
console.log(`  7B:      ${out.outLab.meanL.toFixed(3)}  Δ=${(out.outLab.meanL - out.base6aLab.meanL).toFixed(3)}`);
