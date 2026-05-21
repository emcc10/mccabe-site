import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  ALPHA_PREVIEW,
  COMBINED_OVERLAY_PREVIEW,
  DEBUG_DIR,
  LEGACY_SOURCE,
  LEGACY_UPHOLSTERY_MASK,
  LEG_MASK_PREVIEW,
  PRODUCT_DIR,
  SOURCE_OUT,
  UPHOLSTERY_MASK_PREVIEW,
} from './paths.js';
import {
  buildPhase1Masks,
  loadMaskPng,
  loadRgba,
} from './segment.js';
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
      if (name === 'source.png' || name === 'debug') continue;
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
  const handUpholstery = await loadMaskPng(LEGACY_UPHOLSTERY_MASK, image.width, image.height);
  const { alpha, upholstery, legs } = buildPhase1Masks(image, handUpholstery);

  await writeAlphaPreview(ALPHA_PREVIEW, image, alpha);
  await writeMaskPreview(UPHOLSTERY_MASK_PREVIEW, upholstery);
  await writeMaskPreview(LEG_MASK_PREVIEW, legs);
  await writeCombinedOverlay(COMBINED_OVERLAY_PREVIEW, image, upholstery, legs);

  return {
    source: SOURCE_OUT,
    alphaPreview: ALPHA_PREVIEW,
    upholsteryMaskPreview: UPHOLSTERY_MASK_PREVIEW,
    legMaskPreview: LEG_MASK_PREVIEW,
    combinedOverlayPreview: COMBINED_OVERLAY_PREVIEW,
  };
}
