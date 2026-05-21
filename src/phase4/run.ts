import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { compositePhase2 } from '../phase2/composite.js';
import { measureRecolorMetrics } from '../phase2/metrics.js';
import type { RgbaImage } from '../phase1/segment.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import { recolorUpholsteryRelativeLRemap } from './recolor.js';
import { STAGE4_VARIANTS, variantSettingsLine, type Stage4Variant } from './variants.js';

export const STAGE4_GRID = join(DEBUG_DIR, 'stage4-grid.png');
export const STAGE4_SPEC = join(DEBUG_DIR, 'stage4-spec.json');

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(DEBUG_DIR, { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runStage4() {
  if (!existsSync(SOURCE_OUT)) {
    throw new Error(`Missing ${SOURCE_OUT} — run npm run prove:stage2 first`);
  }

  const source = await loadRgba(SOURCE_OUT);
  const { alpha, upholstery, legs } = await loadPhase1Masks(source);

  const { stats: sharedStats } = recolorUpholsteryRelativeLRemap(
    source,
    upholstery,
    STAGE4_VARIANTS[0].params,
  );

  const results: {
    variant: Stage4Variant;
    outputPath: string;
    upholsteryMeanLabDeltaFromSource: number;
    lStdPreservationRatio: number;
    legExactMatchRatio: number;
  }[] = [];
  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const v of STAGE4_VARIANTS) {
    const outPath = join(DEBUG_DIR, v.outputFile);
    const { image: recolored } = recolorUpholsteryRelativeLRemap(
      source,
      upholstery,
      v.params,
      sharedStats,
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

  await writeVariantGrid(STAGE4_GRID, gridPanels, 3);

  writeFileSync(
    STAGE4_SPEC,
    JSON.stringify(
      {
        stage: 4,
        method: 'relativeLuminanceRemap + swatchChroma',
        notUsing: 'preserveLuminance + chromaBlend (Stage 2–3F)',
        pipeline: 'recolorUpholsteryRelativeLRemap + compositePhase2',
        postRgbPasses: [],
        sourceUpholsteryLabStats: sharedStats,
        chroma: {
          targetA: 0.3,
          targetB: 4.2,
          a_out: 'a_src * 0.12 + target_a * 0.88',
          b_out: 'b_src * 0.10 + target_b * 0.90',
        },
        lRemapFormula: [
          'Ln = clamp((L_src - p5) / (p95 - p5), 0, 1)',
          'L_mapped = L_low + Ln * (L_high - L_low)',
          'L_out = L_mapped * mappedLBlend + L_src * (1 - mappedLBlend)',
        ],
        variants: results.map((r) => ({
          id: r.variant.id,
          label: r.variant.label,
          outputFile: r.variant.outputFile,
          params: r.variant.params,
          upholsteryMeanLabDeltaFromSource: r.upholsteryMeanLabDeltaFromSource,
          lStdPreservationRatio: r.lStdPreservationRatio,
          legExactMatchRatio: r.legExactMatchRatio,
        })),
      },
      null,
      2,
    ),
  );

  return { grid: STAGE4_GRID, spec: STAGE4_SPEC, results, sharedStats };
}
