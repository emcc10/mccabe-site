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

const STATUS_MD = `# TEST-SOFA Bali Silk RealLeather checkpoint

**Checkpoint / revert point only** for the Bali Silk / RealLeather method.

- **Canonical baseline:** REALLEATHER-FINAL-A
- **Source image:** \`phaseRealLeatherFinal-variant-A.png\`
- **Method status:** not production-ready; keep only as a checkpoint
- **Current instruction:** use this as a revert point while building a stronger reference-guided relight pass

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

Do not treat this image as production-ready.
Use it only as a checkpoint while testing stronger reference-guided relighting.
`;

mkdirSync(REALLEATHER_LOCKED_DIR, { recursive: true });
copyFileSync(FINAL_A_PATH, REALLEATHER_LOCKED_IMAGE);
writeFileSync(REALLEATHER_LOCKED_PARAMS, JSON.stringify(buildRealLeatherLockedParams(), null, 2));
writeFileSync(REALLEATHER_LOCKED_STATUS, STATUS_MD);

console.log('Locked TEST-SOFA RealLeather checkpoint\n');
console.log(`  image:  ${resolve(REALLEATHER_LOCKED_IMAGE)}`);
console.log(`  params: ${resolve(REALLEATHER_LOCKED_PARAMS)}`);
console.log(`  status: ${resolve(REALLEATHER_LOCKED_STATUS)}`);
