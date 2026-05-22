import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { buildLower12Region } from '../phase6a/bottomSeam.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { DEBUG_DIR } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import { buildMaterialMaps } from '../phase7/materialModel.js';
import { LOCKED_7B, LOCKED_7B_PARAMS } from '../phase7/spec.js';
import { applyPhase7c } from './apply.js';
import { PHASE7C_VARIANTS, type Phase7cVariant } from './spec.js';
import {
  buildUpperUpholsteryRegion,
  upperRegionMaskToRgb,
  upperRegionStats,
} from './upperRegion.js';
import { writeVariantGrid } from '../phase3b/grid.js';

export const PHASE7C_GRID = join(DEBUG_DIR, 'phase7c-grid.png');
export const PHASE7C_SPEC = join(DEBUG_DIR, 'phase7c-spec.json');
export const PHASE7C_UPPER_MASK = join(DEBUG_DIR, 'phase7c-upper-region-mask.png');

export function phase7cVariantPath(id: string) {
  return join(DEBUG_DIR, `phase7c-variant-${id}.png`);
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

export async function runPhase7c() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const baseLab = meanUpholsteryLab(base6a, upholstery);
  const maps = buildMaterialMaps(source, upholstery);
  const upperRegion = buildUpperUpholsteryRegion(upholstery, lower12);
  const { width, height } = source;

  await writeRgbPng(
    PHASE7C_UPPER_MASK,
    width,
    height,
    upperRegionMaskToRgb(upholstery, upperRegion, width, height),
  );

  const base7b = applyPhase7c(base6a, upholstery, maps, LOCKED_7B_PARAMS, upperRegion.weights, {
    extraMicro: 0,
    extraStructure: 0,
  });
  const base7bLab = meanUpholsteryLab(base7b, upholstery);

  const variantResults: {
    id: string;
    label: string;
    path: string;
    boost: Phase7cVariant['boost'];
    meanL: number;
    deltaLFrom6a: number;
    deltaLFrom7b: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE7C_VARIANTS) {
    const out = applyPhase7c(
      base6a,
      upholstery,
      maps,
      LOCKED_7B_PARAMS,
      upperRegion.weights,
      variant.boost,
    );
    const path = phase7cVariantPath(variant.id);
    await writeRgbaPng(path, out);

    const lab = meanUpholsteryLab(out, upholstery);
    variantResults.push({
      id: variant.id,
      label: variant.label,
      path,
      boost: variant.boost,
      meanL: lab.meanL,
      deltaLFrom6a: lab.meanL - baseLab.meanL,
      deltaLFrom7b: lab.meanL - base7bLab.meanL,
    });

    const b = variant.boost;
    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `+micro=${b.extraMicro} +struct=${b.extraStructure} (upper only)`,
    });
  }

  await writeVariantGrid(PHASE7C_GRID, gridPanels, 2);

  const specBody = {
    phase: '7C',
    purpose:
      'Reduce soft/airbrushed look on upper upholstery (back cushions, arm fronts, seat top/front) — not final Bali Silk',
    lockedUnchanged: [
      'Stage 4B-v3 color mapping',
      'Phase 6A bottom seam fix',
      'Phase 7B global material params (structure/seam/micro/highlight)',
      'masks, alpha, leg restore, edges',
    ],
    base7b: LOCKED_7B,
    method:
      'applyMaterialModel (7B globally) + feathered upper-region micro/structure delta from source maps; seam unchanged',
    functionsChanged: [
      'src/phase7c/upperRegion.ts — buildUpperUpholsteryRegion',
      'src/phase7c/apply.ts — applyPhase7c',
      'src/phase7c/run.ts — runPhase7c',
    ],
    upperRegion: {
      ...upperRegion.definition,
      stats: upperRegionStats(upholstery, upperRegion),
      debugMaskLegend: {
        darkGray: 'outside upholstery',
        orange: 'excluded lower band (dilated lower-12% + bottom 16% uphol bbox) — base rail preserved',
        dimGray: 'upholstery outside upper zones',
        green: 'upper boost weight (brighter = stronger)',
      },
    },
    variants: PHASE7C_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      boost: v.boost,
      note:
        v.id === 'A'
          ? 'Slightly stronger micro recovery on upper surfaces only; no seam increase'
          : 'Same micro boost as A + slightly stronger structure on upper surfaces only; no seam increase',
    })),
    results: variantResults,
    reference7bMeanL: base7bLab.meanL,
    base6aUpholsteryMeanLab: baseLab,
    outputs: {
      grid: PHASE7C_GRID,
      variants: PHASE7C_VARIANTS.map((v) => phase7cVariantPath(v.id)),
      upperRegionMask: PHASE7C_UPPER_MASK,
      spec: PHASE7C_SPEC,
    },
    notes: [
      'No color remap, random noise, global sharpen, edge/mask/alpha changes.',
      'Lower front base rail excluded via dilated lower-12% band.',
      'No single/comparison re-export of unchanged 7B.',
    ],
  };

  writeFileSync(PHASE7C_SPEC, JSON.stringify(specBody, null, 2));

  return {
    grid: PHASE7C_GRID,
    spec: PHASE7C_SPEC,
    upperMask: PHASE7C_UPPER_MASK,
    variants: variantResults,
    upperRegion,
    regionStats: upperRegionStats(upholstery, upperRegion),
    baseLab,
    base7bLab,
  };
}
