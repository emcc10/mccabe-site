#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase9resetSingleB } from '../src/phase9reset/runSingleB.js';

console.log('Phase 9RESET-B: locked single render (not final Bali Silk)\n');

const out = await runPhase9resetSingleB();

console.log(`  ${resolve(out.single)}`);
console.log(`  ${resolve(out.comparison)}`);
