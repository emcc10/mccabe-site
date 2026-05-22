#!/usr/bin/env npx tsx
import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  PREVIEW_LOCKED_DIR,
  PREVIEW_LOCKED_IMAGE,
  PREVIEW_LOCKED_PARAMS,
  PREVIEW_LOCKED_STATUS,
} from '../src/phase1/paths.js';
import { PHASE7C_SINGLE_B } from '../src/phase7c/runSingleB.js';
import { buildPreviewLockedParams } from '../src/phase7c/previewLocked.js';

const STATUS_MD = `# TEST-SOFA sofa render — frozen preview status

**Sofa render project only** (not inspiration boards).

- **Best locked preview version:** 7C-B
- **preview-quality:** yes
- **final-photo-quality:** no
- **Reason:** still too soft / airbrushed for native catalog use
- **Future work:** use a different approach, not more micro-tweaks on the current realism pipeline

## Frozen

- Do not continue Stage 5/6/7 realism tuning on TEST-SOFA unless explicitly requested.
- Do not generate more sofa render variants unless explicitly requested.
- Canonical asset: \`bali-silk-preview.png\` (same pixels as locked 7C-B; render not re-run on freeze).

## Bundle

| File | Role |
|------|------|
| \`bali-silk-preview.png\` | Locked preview image |
| \`params.json\` | Locked pipeline parameters |
| \`STATUS.md\` | This note |

Re-copy bundle from existing 7C-B export: \`npm run export:preview-locked\`
`;

mkdirSync(PREVIEW_LOCKED_DIR, { recursive: true });
copyFileSync(PHASE7C_SINGLE_B, PREVIEW_LOCKED_IMAGE);
writeFileSync(PREVIEW_LOCKED_PARAMS, JSON.stringify(buildPreviewLockedParams(), null, 2));
writeFileSync(PREVIEW_LOCKED_STATUS, STATUS_MD);

console.log('Frozen TEST-SOFA preview bundle (7C-B)\n');
console.log(`  image:  ${resolve(PREVIEW_LOCKED_IMAGE)}`);
console.log(`  params: ${resolve(PREVIEW_LOCKED_PARAMS)}`);
console.log(`  status: ${resolve(PREVIEW_LOCKED_STATUS)}`);
