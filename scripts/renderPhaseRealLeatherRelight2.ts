#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseRealLeatherRelight2 } from '../src/phaseRealLeatherRelight2/run.js';

console.log('Phase RealLeather Relight 2: restrained hybrid from RELIGHT-A\n');

const out = await runPhaseRealLeatherRelight2();

console.log(`  RELIGHT2-A: ${resolve(out.outA)}`);
console.log(`  RELIGHT2-B: ${resolve(out.outB)}`);
console.log(`\n  compare: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
