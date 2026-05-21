import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR } from '../phase1/paths.js';
import { buildStage4bV3Final } from '../phase4b/run.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import type { RgbaImage } from '../phase1/segment.js';
import {
  applyRealismPass,
  buildSourceTextureMaps,
  realismParamsForVariant,
} from './realism.js';
import {
  STAGE5_DETAIL_BLUR_PX,
  STAGE5_HIGHLIGHT_STRENGTH,
  STAGE5_A_VAR_AMP,
  STAGE5_B_VAR_AMP,
  STAGE5_VARIANTS,
} from './spec.js';
import { meanUpholsteryLab } from './labUtil.js';

export const STAGE5_GRID = join(DEBUG_DIR, 'stage5-grid.png');
export const STAGE5_SPEC = join(DEBUG_DIR, 'stage5-spec.json');

export function stage5VariantPath(id: string) {
  return join(DEBUG_DIR, `stage5-variant-${id}.png`);
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runStage5() {
  const { source, base, upholstery } = await buildStage4bV3Final();
  const maps = buildSourceTextureMaps(source, upholstery, STAGE5_DETAIL_BLUR_PX);
  const baseLab = meanUpholsteryLab(base, upholstery);

  const variantResults: {
    id: string;
    label: string;
    path: string;
    detailStrength: number;
    meanL: number;
    meanA: number;
    meanB: number;
    deltaLFromBase: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of STAGE5_VARIANTS) {
    const params = realismParamsForVariant(variant);
    const out = applyRealismPass(base, source, upholstery, maps, params);
    const path = stage5VariantPath(variant.id);
    await writeRgbaPng(path, out);

    const lab = meanUpholsteryLab(out, upholstery);
    variantResults.push({
      id: variant.id,
      label: variant.label,
      path,
      detailStrength: variant.detailStrength,
      meanL: lab.meanL,
      meanA: lab.meanA,
      meanB: lab.meanB,
      deltaLFromBase: lab.meanL - baseLab.meanL,
    });

    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `detail=${variant.detailStrength} hi=${STAGE5_HIGHLIGHT_STRENGTH} a±${STAGE5_A_VAR_AMP} b±${STAGE5_B_VAR_AMP}`,
    });
  }

  await writeVariantGrid(STAGE5_GRID, gridPanels, 3);

  const specBody = {
    stage: 5,
    base: 'Stage 4B-v3 locked (color + edge cleanup unchanged)',
    method: 'detail restore + highlight shaping + micro a/b variation (upholstery mask only)',
    baseUpholsteryMeanLab: baseLab,
    sharedParams: {
      detailBlurPx: STAGE5_DETAIL_BLUR_PX,
      highlightStrength: STAGE5_HIGHLIGHT_STRENGTH,
      aVariationAmplitude: STAGE5_A_VAR_AMP,
      bVariationAmplitude: STAGE5_B_VAR_AMP,
    },
    variants: variantResults,
    outputs: {
      grid: STAGE5_GRID,
      variants: STAGE5_VARIANTS.map((v) => stage5VariantPath(v.id)),
      spec: STAGE5_SPEC,
    },
    notes: [
      'Realism applied only inside core upholstery mask; legs/alpha/edges from Stage 4B-v3 preserved.',
      'L detail is zero-mean over upholstery to avoid global darken.',
    ],
  };

  writeFileSync(STAGE5_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: STAGE5_GRID, spec: STAGE5_SPEC, variants: variantResults, baseLab };
}
