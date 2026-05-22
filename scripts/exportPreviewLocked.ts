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

const STATUS_MD = `# TEST-SOFA Bali Silk — preview pipeline status

**Locked preview version:** 7C-B (Phase 7C variant B on locked 7B)

## Verdict

- **Best locked preview version** for this cognac source → Bali Silk mockup.
- **Preview / mockup quality:** yes — acceptable for internal preview and rough merchandising comps.
- **Final catalog photo quality:** no — still too soft / airbrushed; does not pass as a native product photo.

## Pipeline capability

This realism stack (4B-v3 → 6A → 7B → 7C-B upper boost) is **not capable of final-photo realism** on this source. Further micro-tweaks on the same pipeline are **not justified** — incremental gains do not reach catalog standard.

## Future work

Use a **different approach** (e.g. new source capture, generative/physical reshoot, or a separate texture-transfer method). Do **not** continue iterating Stage 5–7 micro parameters on TEST-SOFA unless explicitly requested.

## Frozen bundle

| File | Role |
|------|------|
| \`bali-silk-preview.png\` | Canonical locked preview image |
| \`params.json\` | Full locked parameters for regeneration |
| \`STATUS.md\` | This note |

Regenerate bundle: \`npm run export:preview-locked\`
`;

mkdirSync(PREVIEW_LOCKED_DIR, { recursive: true });
copyFileSync(PHASE7C_SINGLE_B, PREVIEW_LOCKED_IMAGE);
writeFileSync(PREVIEW_LOCKED_PARAMS, JSON.stringify(buildPreviewLockedParams(), null, 2));
writeFileSync(PREVIEW_LOCKED_STATUS, STATUS_MD);

console.log('Frozen TEST-SOFA preview bundle (7C-B)\n');
console.log(`  image:  ${resolve(PREVIEW_LOCKED_IMAGE)}`);
console.log(`  params: ${resolve(PREVIEW_LOCKED_PARAMS)}`);
console.log(`  status: ${resolve(PREVIEW_LOCKED_STATUS)}`);
