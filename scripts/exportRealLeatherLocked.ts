#!/usr/bin/env npx tsx
import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  REALLEATHER_LOCKED_DIR,
  REALLEATHER_LOCKED_IMAGE,
  REALLEATHER_LOCKED_PARAMS,
  REALLEATHER_LOCKED_STATUS,
} from '../src/phase1/paths.js';
import { phaseRealLeatherFinalVariantPath } from '../src/phaseRealLeatherFinal/run.js';
import { buildRealLeatherLockedParams } from '../src/phaseRealLeatherFinal/locked.js';

const FINAL_A_PATH = phaseRealLeatherFinalVariantPath('A');

const STATUS_MD = `# TEST-SOFA Bali Silk RealLeather baseline

**Locked current best output** for the Bali Silk / RealLeather method.

- **Canonical baseline:** REALLEATHER-FINAL-A
- **Source image:** \`phaseRealLeatherFinal-variant-A.png\`
- **Method status:** locked for integration/generalization
- **Current instruction:** do not continue tuning this swatch unless a new swatch exposes a specific failure

## Preserve

- overall tone from REF2-B / FINAL-A
- seam depth
- cushion separation
- smooth catalog finish
- neutral-warm Bali Silk color

## Do Not Continue

- texture transfer
- Detail phases
- mottle
- visible grain
- micro smoothing
- brightness/shadow tweaks

## Next Step

Apply this RealLeather Reference Match method to the next leather swatch.
Keep the same method unless the next swatch clearly fails.
`;

mkdirSync(REALLEATHER_LOCKED_DIR, { recursive: true });
copyFileSync(FINAL_A_PATH, REALLEATHER_LOCKED_IMAGE);
writeFileSync(REALLEATHER_LOCKED_PARAMS, JSON.stringify(buildRealLeatherLockedParams(), null, 2));
writeFileSync(REALLEATHER_LOCKED_STATUS, STATUS_MD);

console.log('Locked TEST-SOFA RealLeather baseline\n');
console.log(`  image:  ${resolve(REALLEATHER_LOCKED_IMAGE)}`);
console.log(`  params: ${resolve(REALLEATHER_LOCKED_PARAMS)}`);
console.log(`  status: ${resolve(REALLEATHER_LOCKED_STATUS)}`);
