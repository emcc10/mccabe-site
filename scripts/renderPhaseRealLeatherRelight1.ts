#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseRealLeatherRelight1 } from '../src/phaseRealLeatherRelight1/run.js';

console.log('Phase RealLeather Relight 1: stronger reference-guided relighting\n');

const out = await runPhaseRealLeatherRelight1();

console.log(`  RELIGHT-A: ${resolve(out.relightAPath)}`);
console.log(`  RELIGHT-B: ${resolve(out.relightBPath)}`);
console.log(`\n  compare: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
