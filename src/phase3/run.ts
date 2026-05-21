import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { writeCombinedOverlay } from '../phase1/previews.js';
import { writeLabeledComparisonWithLabels } from '../phase2/comparison.js';
import { compositePhase2 } from '../phase2/composite.js';
import { recolorUpholsteryMinimal } from '../phase2/recolor.js';
import type { RgbaImage } from '../phase1/segment.js';
import {
  BALI_SILK_LAB,
  CHROMA_BLEND,
  PRESERVE_LUMINANCE,
  stage3SpecRecord,
} from './spec.js';

export const PHASE3_RECOLOR_OUT = join(DEBUG_DIR, 'phase3-bali-silk.png');
export const PHASE3_COMPARISON_OUT = join(DEBUG_DIR, 'phase3-comparison.png');
export const PHASE3_SPEC_OUT = join(DEBUG_DIR, 'stage3-spec.json');

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(DEBUG_DIR, { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runPhase3() {
  if (!existsSync(SOURCE_OUT)) {
    throw new Error(`Run Phase 1 first — missing ${SOURCE_OUT}`);
  }

  writeFileSync(PHASE3_SPEC_OUT, JSON.stringify(stage3SpecRecord(), null, 2));

  const source = await loadRgba(SOURCE_OUT);
  const { alpha, upholstery, legs } = await loadPhase1Masks(source);

  const recolored = recolorUpholsteryMinimal(
    source,
    upholstery,
    BALI_SILK_LAB,
    PRESERVE_LUMINANCE,
    CHROMA_BLEND,
  );
  const final = compositePhase2(source, recolored, alpha, upholstery, legs);

  await writeRgbaPng(PHASE3_RECOLOR_OUT, final);

  const overlayTmp = `${DEBUG_DIR}/_phase3-overlay-tmp.png`;
  await writeCombinedOverlay(overlayTmp, source, upholstery, legs);
  await writeLabeledComparisonWithLabels(
    PHASE3_COMPARISON_OUT,
    SOURCE_OUT,
    overlayTmp,
    PHASE3_RECOLOR_OUT,
    ['SOURCE', 'MASK OVERLAY', 'STAGE 3 SWATCH MATCH'],
  );

  return {
    recolor: PHASE3_RECOLOR_OUT,
    comparison: PHASE3_COMPARISON_OUT,
    spec: PHASE3_SPEC_OUT,
  };
}
