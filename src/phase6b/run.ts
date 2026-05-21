import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR } from '../phase1/paths.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import { applyRealismPassV2, buildSourceTextureMapsV2 } from './realismV2.js';
import { PHASE6B_VARIANTS, REALISM_V2_SHARED } from './spec.js';

export const PHASE6B_GRID = join(DEBUG_DIR, 'phase6b-grid.png');
export const PHASE6B_SPEC = join(DEBUG_DIR, 'phase6b-spec.json');

export function phase6bVariantPath(id: string) {
  return join(DEBUG_DIR, `phase6b-variant-${id}.png`);
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export async function runPhase6b() {
  const { source, image: base6a, upholstery } = await buildPhase6aBase();
  const baseLab = meanUpholsteryLab(base6a, upholstery);
  const maps = buildSourceTextureMapsV2(
    source,
    upholstery,
    REALISM_V2_SHARED.fineBlurPx,
    REALISM_V2_SHARED.coarseBlurPx,
  );

  const variantResults: {
    id: string;
    label: string;
    path: string;
    params: (typeof PHASE6B_VARIANTS)[0]['params'];
    meanL: number;
    deltaLFrom6a: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE6B_VARIANTS) {
    const out = applyRealismPassV2(base6a, upholstery, maps, variant.params);
    const path = phase6bVariantPath(variant.id);
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
      settings: `detail=${p.detailStrength} hi=${p.highlightStrength} a=${p.aVarAmp} b=${p.bVarAmp}`,
    });
  }

  await writeVariantGrid(PHASE6B_GRID, gridPanels, 3);

  const specBody = {
    phase: '6B',
    purpose: 'Material realism v2 (replaces powdery Stage 5 stack)',
    input: 'Phase 6A output (Stage 4B-v3 color/edges + bottom seam fix)',
    functionsChanged: [
      'src/phase6b/realismV2.ts — buildSourceTextureMapsV2, applyRealismPassV2',
      'src/phase6b/run.ts — runPhase6b',
    ],
    architecture: {
      fineHighPassBlurPx: REALISM_V2_SHARED.fineBlurPx,
      coarseHighPassBlurPx: REALISM_V2_SHARED.coarseBlurPx,
      seamWeightedDetail: true,
      reducedHighlightLift: true,
      upholsteryMaskOnly: true,
    },
    base6aUpholsteryMeanLab: baseLab,
    variants: variantResults,
    outputs: {
      grid: PHASE6B_GRID,
      variants: PHASE6B_VARIANTS.map((v) => phase6bVariantPath(v.id)),
      spec: PHASE6B_SPEC,
    },
    notes: [
      'Does not re-run Stage 5B/5C — new realism on clean 6A compositing base.',
      'No noise, global sharpen, shadow darken, mask/alpha/edge changes.',
    ],
  };

  writeFileSync(PHASE6B_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: PHASE6B_GRID, spec: PHASE6B_SPEC, variants: variantResults, baseLab };
}
