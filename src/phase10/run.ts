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
import { compareUpholsteryImages } from '../phase95/imageCompare.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { applyCleanSwatchMaterial } from '../phase9reset/apply.js';
import { buildCleanSwatchMaterial } from '../phase9reset/swatchSanitize.js';
import { buildLocked9resetBSingle } from '../phase9reset/runSingleB.js';
import { PHASE9RESET_SINGLE_B } from '../phase9reset/runSingleB.js';
import { buildBottomGuard, buildOpenFieldMaterialWeight } from './openFieldWeight.js';
import { PHASE10_VARIANTS, REFERENCE_9RESET_B, type Phase10Variant } from './spec.js';

export const PHASE10_GRID = join(DEBUG_DIR, 'phase10-grid.png');
export const PHASE10_SPEC = join(DEBUG_DIR, 'phase10-spec.json');

export function phase10VariantPath(id: string) {
  return join(DEBUG_DIR, `phase10-variant-${id}.png`);
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runPhase10() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const baseLab = meanUpholsteryLab(base6a, upholstery);

  const swatchImage = await loadImageRGBA(BALI_SILK_SWATCH);
  const clean = buildCleanSwatchMaterial(swatchImage);
  const gates = buildSourceStructureGates(source, upholstery);
  const materialWeight = buildOpenFieldMaterialWeight(upholstery, gates, bottomGuard);

  const { image: ref9resetB } = await buildLocked9resetBSingle();

  const variantResults: {
    id: string;
    label: string;
    path: string;
    params: Phase10Variant['params'];
    meanL: number;
    deltaLFrom6a: number;
    deltaVs9resetB: ReturnType<typeof compareUpholsteryImages>['stats'] & {
      visuallyMeaningful: boolean;
      verdict: string;
    };
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE10_VARIANTS) {
    const out = applyCleanSwatchMaterial(
      base6a,
      upholstery,
      clean,
      gates,
      materialWeight,
      variant.params,
    );
    const path = phase10VariantPath(variant.id);
    await writeRgbaPng(path, out);

    const lab = meanUpholsteryLab(out, upholstery);
    const cmp = compareUpholsteryImages(ref9resetB, out, upholstery);

    variantResults.push({
      id: variant.id,
      label: variant.label,
      path,
      params: variant.params,
      meanL: lab.meanL,
      deltaLFrom6a: lab.meanL - baseLab.meanL,
      deltaVs9resetB: {
        ...cmp.stats,
        visuallyMeaningful: cmp.visuallyMeaningful,
        verdict: cmp.verdict,
      },
    });

    const p = variant.params;
    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `grain=${p.grainStrength} mottle=${p.mottleStrength}`,
    });
  }

  await writeVariantGrid(PHASE10_GRID, gridPanels, 2);

  const specBody = {
    phase: 10,
    purpose: 'One real stronger swatch-material attempt — must be visibly different from 9RESET-B',
    notFinalBaliSilk: true,
    reference9resetB: {
      path: PHASE9RESET_SINGLE_B,
      params: REFERENCE_9RESET_B,
    },
    apply: 'open-field weight only (back/seat/arm/rail); strong seam/highlight suppress',
    lockedUnchanged: [
      'Stage 4B-v3',
      'Phase 6A',
      'masks, alpha, legs, edges',
      'Phase 9 reset swatch sanitization + stochastic sampling',
    ],
    variants: PHASE10_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      intent: v.intent,
      params: v.params,
    })),
    results: variantResults,
    base6aUpholsteryMeanLab: baseLab,
    outputs: {
      grid: PHASE10_GRID,
      variants: PHASE10_VARIANTS.map((v) => phase10VariantPath(v.id)),
      spec: PHASE10_SPEC,
    },
  };

  writeFileSync(PHASE10_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: PHASE10_GRID, spec: PHASE10_SPEC, variants: variantResults };
}
