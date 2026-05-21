#!/usr/bin/env npx tsx
import { resolve } from 'path';
import { runPhase3 } from '../src/phase3/run.js';

const out = await runPhase3();
console.log('Stage 3 outputs:');
console.log(`  ${resolve(out.recolor)}`);
console.log(`  ${resolve(out.comparison)}`);
console.log(`  ${resolve(out.spec)}`);
