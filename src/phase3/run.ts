import { existsSync, mkdirSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { SOURCE_OUT } from '../phase1/paths.js';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { writeCombinedOverlay } from '../phase1/previews.js';
import { writeLabeledComparisonWithLabels } from '../phase2/comparison.js';
import { compositePhase2 } from '../phase2/composite.js';
import { measureRecolorMetrics } from '../phase2/metrics.js';
import { recolorUpholsteryMinimal } from '../phase2/recolor.js';
import type { RgbaImage } from '../phase1/segment.js';
import {
  BALI_SILK_LAB,
  CHROMA_BLEND,
  PRESERVE_LUMINANCE,
  stage3SpecRecord,
} from './spec.js';
import {
  PHASE3_COMPARISON_OUT,
  PHASE3_METRICS_OUT,
  PHASE3_RECOLOR_OUT,
  PHASE3_SPEC_OUT,
} from './paths.js';

export interface Phase3RunResult {
  recolor: string;
  comparison: string;
  spec: string;
  metrics: string;
  metricsData: Awaited<ReturnType<typeof measureRecolorMetrics>>;
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(path.replace(/[^/\\]+$/, ''), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runPhase3(): Promise<Phase3RunResult> {
  if (!existsSync(SOURCE_OUT)) {
    throw new Error(`Run Phase 1 first (npm run phase1:test-sofa) — missing ${SOURCE_OUT}`);
  }

  const spec = stage3SpecRecord();
  writeFileSync(PHASE3_SPEC_OUT, JSON.stringify(spec, null, 2));

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

  const overlayTmp = PHASE3_COMPARISON_OUT.replace('phase3-comparison.png', '_phase3-overlay-tmp.png');
  await writeCombinedOverlay(overlayTmp, source, upholstery, legs);
  await writeLabeledComparisonWithLabels(
    PHASE3_COMPARISON_OUT,
    SOURCE_OUT,
    overlayTmp,
    PHASE3_RECOLOR_OUT,
    ['SOURCE', 'MASK OVERLAY', 'STAGE 3 SWATCH MATCH'],
  );

  const metricsData = measureRecolorMetrics(source, recolored, final, upholstery, legs);
  writeFileSync(PHASE3_METRICS_OUT, JSON.stringify(metricsData, null, 2));

  return {
    recolor: PHASE3_RECOLOR_OUT,
    comparison: PHASE3_COMPARISON_OUT,
    spec: PHASE3_SPEC_OUT,
    metrics: PHASE3_METRICS_OUT,
    metricsData,
  };
}
