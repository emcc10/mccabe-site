import { existsSync, mkdirSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { writeCombinedOverlay } from '../phase1/previews.js';
import { writeLabeledComparison } from './comparison.js';
import { measureRecolorMetrics } from './metrics.js';
import {
  BALI_SILK_LAB,
  CHROMA_BLEND,
  PHASE2_COMPARISON_OUT,
  PHASE2_METRICS_OUT,
  PHASE2_RECOLOR_OUT,
  PHASE2_SPEC_OUT,
  PRESERVE_LUMINANCE,
  stage2SpecRecord,
} from './paths.js';
import { compositePhase2 } from './composite.js';
import { recolorUpholsteryMinimal } from './recolor.js';
import type { RgbaImage } from '../phase1/segment.js';

export interface Phase2RunResult {
  recolor: string;
  comparison: string;
  spec: string;
  metrics: string;
  structural: Awaited<ReturnType<typeof measureRecolorMetrics>>;
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(DEBUG_DIR, { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runPhase2(): Promise<Phase2RunResult> {
  if (!existsSync(SOURCE_OUT)) {
    throw new Error(`Run Phase 1 first — missing ${SOURCE_OUT}`);
  }

  writeFileSync(PHASE2_SPEC_OUT, JSON.stringify(stage2SpecRecord(), null, 2));

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

  await writeRgbaPng(PHASE2_RECOLOR_OUT, final);

  const overlayTmp = `${DEBUG_DIR}/_phase2-overlay-tmp.png`;
  await writeCombinedOverlay(overlayTmp, source, upholstery, legs);
  await writeLabeledComparison(
    PHASE2_COMPARISON_OUT,
    SOURCE_OUT,
    overlayTmp,
    PHASE2_RECOLOR_OUT,
  );

  const structural = measureRecolorMetrics(source, recolored, final, upholstery, legs);
  writeFileSync(PHASE2_METRICS_OUT, JSON.stringify(structural, null, 2));

  return {
    recolor: PHASE2_RECOLOR_OUT,
    comparison: PHASE2_COMPARISON_OUT,
    spec: PHASE2_SPEC_OUT,
    metrics: PHASE2_METRICS_OUT,
    structural,
  };
}
