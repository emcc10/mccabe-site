#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase7cSingleB } from '../src/phase7c/runSingleB.js';

console.log('Phase 7C-B: locked single render (not final Bali Silk)\n');

const out = await runPhase7cSingleB();

console.log(`  ${resolve(out.single)}`);
console.log(`  ${resolve(out.comparison)}`);
