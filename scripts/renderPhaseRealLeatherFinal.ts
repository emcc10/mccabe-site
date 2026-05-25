#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhaseRealLeatherFinal } from '../src/phaseRealLeatherFinal/run.js';

console.log('Phase RealLeather Final: REF2-B export plus optional upper-cushion cleanup\n');

const out = await runPhaseRealLeatherFinal();

console.log(`  FINAL-A: ${resolve(out.finalAPath)}`);
console.log(`  FINAL-B: ${resolve(out.finalBPath)}`);
console.log(`\n  compare: ${resolve(out.compareGrid)}`);
console.log(`  ${resolve(out.spec)}`);
