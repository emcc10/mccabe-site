import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR } from '../phase1/paths.js';
import { buildStage4bV3Final } from '../phase4b/run.js';
import { LOCKED_5B } from '../phase5b/spec.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import {
  applyRealismDeltaPass,
  applyRealismPass,
  buildSourceTextureMaps,
  type RealismPassParams,
} from '../phase5/realism.js';
import { LOCKED_5C_C_PARAMS, STAGE5C_VARIANTS } from './spec.js';

export const STAGE5C_GRID = join(DEBUG_DIR, 'stage5c-grid.png');
export const STAGE5C_SPEC = join(DEBUG_DIR, 'stage5c-spec.json');

export function stage5cVariantPath(id: string) {
  return join(DEBUG_DIR, `stage5c-variant-${id}.png`);
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export function locked5bParams(): RealismPassParams {
  return {
    detailStrength: LOCKED_5B.detailStrength,
    highlightStrength: LOCKED_5B.highlightStrength,
    aVarAmp: LOCKED_5B.aVariationAmplitude,
    bVarAmp: LOCKED_5B.bVariationAmplitude,
  };
}

export function deltaFrom5b(target: RealismPassParams): RealismPassParams {
  const b = locked5bParams();
  return {
    detailStrength: target.detailStrength - b.detailStrength,
    highlightStrength: target.highlightStrength - b.highlightStrength,
    aVarAmp: target.aVarAmp - b.aVarAmp,
    bVarAmp: target.bVarAmp - b.bVarAmp,
  };
}

/** Stage 4B-v3 → 5B → locked 5C-C realism chain (upholstery mask only). */
export async function buildLocked5cCFinal() {
  const { source, base: base4b, upholstery } = await buildStage4bV3Final();
  const maps = buildSourceTextureMaps(source, upholstery, LOCKED_5B.detailBlurPx);
  const stage5b = applyRealismPass(base4b, source, upholstery, maps, locked5bParams());
  const delta = deltaFrom5b(LOCKED_5C_C_PARAMS);
  const final = applyRealismDeltaPass(stage5b, upholstery, maps, delta);
  return { source, final, upholstery, stage5b, maps };
}

export async function runStage5c() {
  const { source, base: base4b, upholstery } = await buildStage4bV3Final();
  const maps = buildSourceTextureMaps(source, upholstery, LOCKED_5B.detailBlurPx);

  const stage5b = applyRealismPass(base4b, source, upholstery, maps, locked5bParams());
  const stage5bLab = meanUpholsteryLab(stage5b, upholstery);

  const variantResults: {
    id: string;
    label: string;
    path: string;
    params: RealismPassParams;
    deltaFrom5b: RealismPassParams;
    meanL: number;
    deltaLFrom5b: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of STAGE5C_VARIANTS) {
    const delta = deltaFrom5b(variant.params);
    const out = applyRealismDeltaPass(stage5b, upholstery, maps, delta);
    const path = stage5cVariantPath(variant.id);
    await writeRgbaPng(path, out);

    const lab = meanUpholsteryLab(out, upholstery);
    variantResults.push({
      id: variant.id,
      label: variant.label,
      path,
      params: variant.params,
      deltaFrom5b: delta,
      meanL: lab.meanL,
      deltaLFrom5b: lab.meanL - stage5bLab.meanL,
    });

    const p = variant.params;
    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `detail=${p.detailStrength} hi=${p.highlightStrength} a±${p.aVarAmp} b±${p.bVarAmp}`,
    });
  }

  await writeVariantGrid(STAGE5C_GRID, gridPanels, 3);

  const specBody = {
    stage: '5C',
    base: 'Stage 5B locked + micro-refinement delta (Stage 4B-v3 color/edges unchanged)',
    lockedBaseline: locked5bParams(),
    method:
      'applyRealismPass(4B-v3 → 5B) then applyRealismDeltaPass(5B → 5C variant); upholstery mask only',
    stage5bUpholsteryMeanLab: stage5bLab,
    variants: variantResults,
    outputs: {
      grid: STAGE5C_GRID,
      variants: STAGE5C_VARIANTS.map((v) => stage5cVariantPath(v.id)),
      spec: STAGE5C_SPEC,
    },
    notes: [
      'No color remap, edge changes, shadow darken, noise, or global sharpen.',
      'Delta strengths are variant minus locked 5B so refinements stay micro.',
    ],
  };

  writeFileSync(STAGE5C_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: STAGE5C_GRID, spec: STAGE5C_SPEC, variants: variantResults, stage5bLab };
}
