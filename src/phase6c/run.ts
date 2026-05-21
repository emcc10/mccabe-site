import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR } from '../phase1/paths.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { applyRealismPassV2, buildSourceTextureMapsV2 } from '../phase6b/realismV2.js';
import { LOCKED_6B_B } from '../phase6b/spec.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import { PHASE6C_VARIANTS, realismParamsFor6cVariant } from './spec.js';

export const PHASE6C_GRID = join(DEBUG_DIR, 'phase6c-grid.png');
export const PHASE6C_SPEC = join(DEBUG_DIR, 'phase6c-spec.json');

export function phase6cVariantPath(id: string) {
  return join(DEBUG_DIR, `phase6c-variant-${id}.png`);
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runPhase6c() {
  const { source, image: base6a, upholstery } = await buildPhase6aBase();
  const base6aLab = meanUpholsteryLab(base6a, upholstery);
  const base6bLab = meanUpholsteryLab(
    applyRealismPassV2(
      base6a,
      upholstery,
      buildSourceTextureMapsV2(source, upholstery, LOCKED_6B_B.fineBlurPx, LOCKED_6B_B.coarseBlurPx),
      LOCKED_6B_B,
    ),
    upholstery,
  );

  const maps = buildSourceTextureMapsV2(
    source,
    upholstery,
    LOCKED_6B_B.fineBlurPx,
    LOCKED_6B_B.coarseBlurPx,
  );

  const variantResults: {
    id: string;
    label: string;
    path: string;
    params: ReturnType<typeof realismParamsFor6cVariant>;
    meanL: number;
    deltaLFrom6bB: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE6C_VARIANTS) {
    const params = realismParamsFor6cVariant(variant);
    const out = applyRealismPassV2(base6a, upholstery, maps, params);
    const path = phase6cVariantPath(variant.id);
    await writeRgbaPng(path, out);

    const lab = meanUpholsteryLab(out, upholstery);
    variantResults.push({
      id: variant.id,
      label: variant.label,
      path,
      params,
      meanL: lab.meanL,
      deltaLFrom6bB: lab.meanL - base6bLab.meanL,
    });

    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `fine×${params.fineDetailScale} seam=${params.seamBoost} irr=${params.luminanceIrregularityAmp ?? 0}`,
    });
  }

  await writeVariantGrid(PHASE6C_GRID, gridPanels, 3);

  const specBody = {
    phase: '6C',
    purpose: 'Realism naturalization on locked 6B-B (less digital smoothness)',
    input: 'Phase 6A (4B-v3 color/edges + bottom seam fix)',
    lockedBase: '6B-B',
    locked6bB: LOCKED_6B_B,
    functionsChanged: [
      'src/phase6b/realismV2.ts — fineDetailScale, luminanceIrregularityAmp, lIrregularity map',
      'src/phase6c/spec.ts — PHASE6C_VARIANTS',
      'src/phase6c/run.ts — runPhase6c',
    ],
    upholsteryMeanLab: { base6a: base6aLab, locked6bB: base6bLab },
    variants: variantResults,
    outputs: {
      grid: PHASE6C_GRID,
      variants: PHASE6C_VARIANTS.map((v) => phase6cVariantPath(v.id)),
      spec: PHASE6C_SPEC,
    },
    notes: [
      'Single realism pass from 6A per variant (not stacked on 6B-B image).',
      'No noise, global sharpen, color remap, edge/bottom/alpha/mask changes.',
    ],
  };

  writeFileSync(PHASE6C_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: PHASE6C_GRID, spec: PHASE6C_SPEC, variants: variantResults, base6bLab };
}
