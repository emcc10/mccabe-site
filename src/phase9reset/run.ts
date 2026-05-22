import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { buildLower12Region } from '../phase6a/bottomSeam.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { BALI_SILK_SWATCH, DEBUG_DIR } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import { loadImageRGBA } from '../recolor/imageIO.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import { buildBottomGuard, buildSwatchMaterialWeight } from '../phase9/materialWeight.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { applyCleanSwatchMaterial } from './apply.js';
import { PHASE9RESET_VARIANTS, type Phase9ResetVariant } from './spec.js';
import {
  artifactMaskPreview,
  buildCleanSwatchMaterial,
  colorBiasPreview,
  fieldToGrayPreview,
} from './swatchSanitize.js';

export const PHASE9RESET_GRID = join(DEBUG_DIR, 'phase9reset-grid.png');
export const PHASE9RESET_SPEC = join(DEBUG_DIR, 'phase9reset-spec.json');

export const PHASE9_CLEAN_SWATCH_BASE = join(DEBUG_DIR, 'phase9-clean-swatch-base.png');
export const PHASE9_CLEAN_SWATCH_GRAIN = join(DEBUG_DIR, 'phase9-clean-swatch-grain.png');
export const PHASE9_CLEAN_SWATCH_MOTTLE = join(DEBUG_DIR, 'phase9-clean-swatch-mottle.png');
export const PHASE9_CLEAN_SWATCH_COLOR_BIAS = join(DEBUG_DIR, 'phase9-clean-swatch-color-bias.png');
export const PHASE9_SWATCH_ARTIFACT_MASK = join(DEBUG_DIR, 'phase9-swatch-artifact-mask.png');

export function phase9resetVariantPath(id: string) {
  return join(DEBUG_DIR, `phase9reset-variant-${id}.png`);
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

async function writeRgbPng(path: string, width: number, height: number, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(path);
}

export async function runPhase9Reset() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const baseLab = meanUpholsteryLab(base6a, upholstery);

  const swatchImage = await loadImageRGBA(BALI_SILK_SWATCH);
  const clean = buildCleanSwatchMaterial(swatchImage);
  const gates = buildSourceStructureGates(source, upholstery);
  const materialWeight = buildSwatchMaterialWeight(upholstery, gates, bottomGuard);

  await writeRgbPng(PHASE9_CLEAN_SWATCH_BASE, clean.width, clean.height, clean.cleanBaseRgb);
  await writeRgbPng(
    PHASE9_CLEAN_SWATCH_GRAIN,
    clean.width,
    clean.height,
    fieldToGrayPreview(clean.grain, clean.width, clean.height),
  );
  await writeRgbPng(
    PHASE9_CLEAN_SWATCH_MOTTLE,
    clean.width,
    clean.height,
    fieldToGrayPreview(clean.mottle, clean.width, clean.height),
  );
  await writeRgbPng(
    PHASE9_CLEAN_SWATCH_COLOR_BIAS,
    clean.width,
    clean.height,
    colorBiasPreview(clean.colorBiasA, clean.colorBiasB, clean.width, clean.height),
  );
  await writeRgbPng(
    PHASE9_SWATCH_ARTIFACT_MASK,
    clean.width,
    clean.height,
    artifactMaskPreview(clean.artifactMask, clean.width, clean.height),
  );

  const variantResults: {
    id: string;
    label: string;
    path: string;
    params: Phase9ResetVariant['params'];
    meanL: number;
    deltaLFrom6a: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE9RESET_VARIANTS) {
    const out = applyCleanSwatchMaterial(
      base6a,
      upholstery,
      clean,
      gates,
      materialWeight,
      variant.params,
    );
    const path = phase9resetVariantPath(variant.id);
    await writeRgbaPng(path, out);

    const lab = meanUpholsteryLab(out, upholstery);
    variantResults.push({
      id: variant.id,
      label: variant.label,
      path,
      params: variant.params,
      meanL: lab.meanL,
      deltaLFrom6a: lab.meanL - baseLab.meanL,
    });

    const p = variant.params;
    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `grain=${p.grainStrength} mottle=${p.mottleStrength} stochastic`,
    });
  }

  await writeVariantGrid(PHASE9RESET_GRID, gridPanels, 2);

  const specBody = {
    phase: '9-reset',
    purpose: 'Clean swatch material extraction + stochastic apply (replaces failed Phase 9 tiling)',
    notFinalBaliSilk: true,
    input: 'Stage 4B-v3 + Phase 6A; cognac source structure only',
    swatchSource: BALI_SILK_SWATCH,
    sanitization: {
      lightingFlatten: `L − boxBlur(${28}px) + mean`,
      artifactRemoval: 'oriented line + anisotropy + lighting residual mask, inpaint',
      sampling: '5-offset hash blend per pixel (no literal patch tiling)',
    },
    lockedUnchanged: [
      'Stage 4B-v3 color mapping',
      'Phase 6A bottom seam fix',
      'masks, alpha, leg restore, edge cleanup',
    ],
    failedApproach: 'Phase 9 literal tiled patch transfer (diagonal fold + block repeat)',
    variants: PHASE9RESET_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      intent: v.intent,
      params: v.params,
    })),
    results: variantResults,
    base6aUpholsteryMeanLab: baseLab,
    outputs: {
      grid: PHASE9RESET_GRID,
      variants: PHASE9RESET_VARIANTS.map((v) => phase9resetVariantPath(v.id)),
      cleanSwatchBase: PHASE9_CLEAN_SWATCH_BASE,
      cleanSwatchGrain: PHASE9_CLEAN_SWATCH_GRAIN,
      cleanSwatchMottle: PHASE9_CLEAN_SWATCH_MOTTLE,
      cleanSwatchColorBias: PHASE9_CLEAN_SWATCH_COLOR_BIAS,
      swatchArtifactMask: PHASE9_SWATCH_ARTIFACT_MASK,
      spec: PHASE9RESET_SPEC,
    },
  };

  writeFileSync(PHASE9RESET_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: PHASE9RESET_GRID, spec: PHASE9RESET_SPEC, variants: variantResults, baseLab, clean };
}
