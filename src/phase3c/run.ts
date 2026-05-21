import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { compositePhase2 } from '../phase2/composite.js';
import { measureRecolorMetrics } from '../phase2/metrics.js';
import { recolorUpholsteryMinimal } from '../phase2/recolor.js';
import type { RgbaImage } from '../phase1/segment.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import { STAGE3C_VARIANTS, variantSettingsLine, type Stage3cVariant } from './variants.js';

export const STAGE3C_GRID = join(DEBUG_DIR, 'stage3c-grid.png');
export const STAGE3C_SPEC = join(DEBUG_DIR, 'stage3c-spec.json');

export interface VariantResult {
  variant: Stage3cVariant;
  outputPath: string;
  upholsteryMeanLabDeltaFromSource: number;
  lStdPreservationRatio: number;
  legExactMatchRatio: number;
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(DEBUG_DIR, { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runStage3c(): Promise<{
  grid: string;
  spec: string;
  results: VariantResult[];
}> {
  if (!existsSync(SOURCE_OUT)) {
    throw new Error(`Missing ${SOURCE_OUT} — run npm run prove:stage2 first`);
  }

  const source = await loadRgba(SOURCE_OUT);
  const { alpha, upholstery, legs } = await loadPhase1Masks(source);

  const results: VariantResult[] = [];
  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const v of STAGE3C_VARIANTS) {
    const outPath = join(DEBUG_DIR, v.outputFile);
    const recolored = recolorUpholsteryMinimal(
      source,
      upholstery,
      v.targetLab,
      v.preserveLuminance,
      v.chromaBlend,
    );
    const final = compositePhase2(source, recolored, alpha, upholstery, legs);
    await writeRgbaPng(outPath, final);
    const metrics = measureRecolorMetrics(source, recolored, final, upholstery, legs);
    results.push({
      variant: v,
      outputPath: outPath,
      upholsteryMeanLabDeltaFromSource: metrics.upholsteryMeanLabDeltaFromSource,
      lStdPreservationRatio: metrics.lStdPreservationRatio,
      legExactMatchRatio: metrics.legExactMatchRatio,
    });
    gridPanels.push({
      imagePath: outPath,
      title: v.label,
      settings: variantSettingsLine(v),
    });
  }

  await writeVariantGrid(STAGE3C_GRID, gridPanels, 2);

  const spec = {
    stage: '3C',
    locked3bCandidate: 'F (not final Bali Silk)',
    pipeline: 'recolorUpholsteryMinimal + compositePhase2',
    textureHighlightShadowDrift: 0,
    postRgbPasses: [],
    variants: results.map((r) => ({
      id: r.variant.id,
      label: r.variant.label,
      outputFile: r.variant.outputFile,
      targetLab: r.variant.targetLab,
      preserveLuminance: r.variant.preserveLuminance,
      chromaBlend: r.variant.chromaBlend,
      upholsteryMeanLabDeltaFromSource: r.upholsteryMeanLabDeltaFromSource,
      lStdPreservationRatio: r.lStdPreservationRatio,
      legExactMatchRatio: r.legExactMatchRatio,
    })),
  };
  writeFileSync(STAGE3C_SPEC, JSON.stringify(spec, null, 2));

  return { grid: STAGE3C_GRID, spec: STAGE3C_SPEC, results };
}
