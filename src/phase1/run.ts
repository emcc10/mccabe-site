import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  ALPHA_PREVIEW,
  COMBINED_OVERLAY_PREVIEW,
  DEBUG_DIR,
  LEGACY_SOURCE,
  LEGACY_UPHOLSTERY_MASK,
  LEG_MASK_OVERRIDE,
  LEG_MASK_PREVIEW,
  PRODUCT_DIR,
  SOURCE_OUT,
  UPHOLSTERY_MASK_PREVIEW,
} from './paths.js';
import { loadPhase1Masks } from './loadMasks.js';
import { loadMaskPng, loadRgba } from './segment.js';
import {
  writeAlphaPreview,
  writeCombinedOverlay,
  writeMaskPreview,
} from './previews.js';

export interface Phase1Outputs {
  source: string;
  alphaPreview: string;
  upholsteryMaskPreview: string;
  legMaskPreview: string;
  combinedOverlayPreview: string;
}

const PHASE1_DEBUG_FILES = new Set([
  'alpha-preview.png',
  'upholstery-mask-preview.png',
  'leg-mask-preview.png',
  'combined-overlay-preview.png',
]);

function cleanPriorOutputs() {
  if (existsSync(DEBUG_DIR)) {
    for (const name of readdirSync(DEBUG_DIR)) {
      if (!PHASE1_DEBUG_FILES.has(name)) {
        unlinkSync(join(DEBUG_DIR, name));
      }
    }
  }
  if (existsSync(PRODUCT_DIR)) {
    for (const name of readdirSync(PRODUCT_DIR)) {
      if (name === 'source.png' || name === 'debug' || name === 'leg-mask.override.png') continue;
      unlinkSync(join(PRODUCT_DIR, name));
    }
  }
}

export async function runPhase1(): Promise<Phase1Outputs> {
  mkdirSync(PRODUCT_DIR, { recursive: true });
  mkdirSync(DEBUG_DIR, { recursive: true });
  cleanPriorOutputs();

  copyFileSync(LEGACY_SOURCE, SOURCE_OUT);
  const image = await loadRgba(SOURCE_OUT);
  if (existsSync(LEG_MASK_OVERRIDE)) {
    console.log(`  leg mask: hand-edited override (${LEG_MASK_OVERRIDE})`);
  } else {
    console.log('  leg mask: auto-detected (no leg-mask.override.png)');
  }
  const { alpha, upholstery, legs } = await loadPhase1Masks(image);
  const handLegs = existsSync(LEG_MASK_OVERRIDE);

  await writeAlphaPreview(ALPHA_PREVIEW, image, alpha);
  await writeMaskPreview(UPHOLSTERY_MASK_PREVIEW, upholstery);
  if (handLegs) {
    copyFileSync(LEG_MASK_OVERRIDE, LEG_MASK_PREVIEW);
  } else {
    await writeMaskPreview(LEG_MASK_PREVIEW, legs);
  }
  await writeCombinedOverlay(COMBINED_OVERLAY_PREVIEW, image, upholstery, legs);

  return {
    source: SOURCE_OUT,
    alphaPreview: ALPHA_PREVIEW,
    upholsteryMaskPreview: UPHOLSTERY_MASK_PREVIEW,
    legMaskPreview: LEG_MASK_PREVIEW,
    combinedOverlayPreview: COMBINED_OVERLAY_PREVIEW,
  };
}
