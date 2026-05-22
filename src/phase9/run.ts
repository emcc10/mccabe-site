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
import { buildBottomGuard, buildSwatchMaterialWeight } from './materialWeight.js';
import { buildSourceStructureGates } from './sourceStructure.js';
import { buildSwatchDerivedMaps, swatchMapToPreviewBuffer } from './swatchMaps.js';
import { applySwatchTransfer } from './swatchTransfer.js';
import { PHASE9_VARIANTS, type Phase9Variant } from './spec.js';

export const PHASE9_GRID = join(DEBUG_DIR, 'phase9-grid.png');
export const PHASE9_SPEC = join(DEBUG_DIR, 'phase9-spec.json');
export const PHASE9_SWATCH_GRAIN = join(DEBUG_DIR, 'phase9-swatch-grain-map.png');
export const PHASE9_SWATCH_MOTTLE = join(DEBUG_DIR, 'phase9-swatch-mottle-map.png');
export const PHASE9_SWATCH_COLOR_BIAS = join(DEBUG_DIR, 'phase9-swatch-color-bias-map.png');

export function phase9VariantPath(id: string) {
  return join(DEBUG_DIR, `phase9-variant-${id}.png`);
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

export async function runPhase9() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const baseLab = meanUpholsteryLab(base6a, upholstery);

  const swatchImage = await loadImageRGBA(BALI_SILK_SWATCH);
  const swatchMaps = buildSwatchDerivedMaps(swatchImage);
  const gates = buildSourceStructureGates(source, upholstery);
  const materialWeight = buildSwatchMaterialWeight(upholstery, gates, bottomGuard);

  await writeRgbPng(
    PHASE9_SWATCH_GRAIN,
    swatchMaps.width,
    swatchMaps.height,
    swatchMapToPreviewBuffer(swatchMaps.grain, swatchMaps.width, swatchMaps.height),
  );
  await writeRgbPng(
    PHASE9_SWATCH_MOTTLE,
    swatchMaps.width,
    swatchMaps.height,
    swatchMapToPreviewBuffer(swatchMaps.mottle, swatchMaps.width, swatchMaps.height),
  );
  const biasPreview = Buffer.alloc(swatchMaps.width * swatchMaps.height * 3);
  for (let j = 0; j < swatchMaps.grain.length; j++) {
    const o = j * 3;
    biasPreview[o] = 128 + Math.round(swatchMaps.colorBiasA[j] * 18);
    biasPreview[o + 1] = 128 + Math.round(swatchMaps.colorBiasB[j] * 18);
    biasPreview[o + 2] = 128;
  }
  await writeRgbPng(PHASE9_SWATCH_COLOR_BIAS, swatchMaps.width, swatchMaps.height, biasPreview);

  const variantResults: {
    id: string;
    label: string;
    path: string;
    params: Phase9Variant['params'];
    meanL: number;
    deltaLFrom6a: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE9_VARIANTS) {
    const out = applySwatchTransfer(
      base6a,
      upholstery,
      swatchMaps,
      gates,
      materialWeight,
      variant.params,
    );
    const path = phase9VariantPath(variant.id);
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
      settings: `grain=${p.grainStrength} mottle=${p.mottleStrength}`,
    });
  }

  await writeVariantGrid(PHASE9_GRID, gridPanels, 2);

  const specBody = {
    phase: 9,
    purpose: 'Swatch-derived material transfer — replaces source-L realism (Phases 5–8)',
    notFinalBaliSilk: true,
    input: 'Stage 4B-v3 + Phase 6A; cognac source for structure only',
    swatchSource: BALI_SILK_SWATCH,
    swatchPatch: { width: swatchMaps.width, height: swatchMaps.height, cropFrac: 0.72 },
    method: {
      swatchGrain: 'L − blur(3px), lighting removed via crop + normalization',
      swatchMottle: 'blur(7) − blur(22) from swatch L',
      swatchColorBias: 'local a/b residual from swatch (restrained apply)',
      source: 'form/seam/highlight gates from cognac L only',
      apply: 'tiled swatch samples × material weight (open fields, not seams/highlights)',
    },
    lockedUnchanged: [
      'Stage 4B-v3 color mapping',
      'Phase 6A bottom seam fix',
      'masks, alpha, leg restore, edge cleanup',
    ],
    abandoned: 'Phase 5/6/7/8 source-luminance realism (ceiling reached)',
    variants: PHASE9_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      intent: v.intent,
      params: v.params,
    })),
    results: variantResults,
    base6aUpholsteryMeanLab: baseLab,
    outputs: {
      grid: PHASE9_GRID,
      variants: PHASE9_VARIANTS.map((v) => phase9VariantPath(v.id)),
      swatchGrainMap: PHASE9_SWATCH_GRAIN,
      swatchMottleMap: PHASE9_SWATCH_MOTTLE,
      swatchColorBiasMap: PHASE9_SWATCH_COLOR_BIAS,
      spec: PHASE9_SPEC,
    },
    restrictions: [
      'No random/procedural noise, mask/alpha/edge/feet/bottom changes, global sharpen',
      'No uniform swatch slap — gated by seam/highlight/zone weights',
    ],
  };

  writeFileSync(PHASE9_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: PHASE9_GRID, spec: PHASE9_SPEC, variants: variantResults, baseLab, swatchMaps };
}
