import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR } from '../phase1/paths.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import {
  applyMaterialModel,
  buildMaterialMaps,
  materialMapToPreviewBuffer,
} from './materialModel.js';
import { PHASE7_VARIANTS } from './spec.js';

export const PHASE7_GRID = join(DEBUG_DIR, 'phase7-grid.png');
export const PHASE7_SPEC = join(DEBUG_DIR, 'phase7-spec.json');
export const PHASE7_STRUCTURE_MAP = join(DEBUG_DIR, 'phase7-structure-map.png');
export const PHASE7_SEAM_MAP = join(DEBUG_DIR, 'phase7-seam-map.png');
export const PHASE7_MICRO_MAP = join(DEBUG_DIR, 'phase7-micro-material-map.png');

export function phase7VariantPath(id: string) {
  return join(DEBUG_DIR, `phase7-variant-${id}.png`);
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

export async function runPhase7() {
  const { source, image: base6a, upholstery } = await buildPhase6aBase();
  const baseLab = meanUpholsteryLab(base6a, upholstery);
  const maps = buildMaterialMaps(source, upholstery);
  const { width, height } = source;

  await writeRgbPng(
    PHASE7_STRUCTURE_MAP,
    width,
    height,
    materialMapToPreviewBuffer(maps.structure, upholstery, width, height),
  );
  await writeRgbPng(
    PHASE7_SEAM_MAP,
    width,
    height,
    materialMapToPreviewBuffer(maps.seam, upholstery, width, height),
  );
  await writeRgbPng(
    PHASE7_MICRO_MAP,
    width,
    height,
    materialMapToPreviewBuffer(maps.micro, upholstery, width, height),
  );

  const variantResults: {
    id: string;
    label: string;
    path: string;
    params: Phase7Variant['params'];
    meanL: number;
    deltaLFrom6a: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE7_VARIANTS) {
    const out = applyMaterialModel(base6a, upholstery, maps, variant.params);
    const path = phase7VariantPath(variant.id);
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
      settings: `struct=${p.structureStrength} seam=${p.seamStrength} micro=${p.microStrength}`,
    });
  }

  await writeVariantGrid(PHASE7_GRID, gridPanels, 2);

  const specBody = {
    phase: 7,
    purpose: 'Material model reset — replaces Stage 5/6 realism stack (not stacked on 6C-B)',
    input: 'Stage 4B-v3 color + Phase 6A bottom seam fix',
    method: 'structure map + selective seam/crease + micro material + soft highlight',
    functionsChanged: [
      'src/phase7/materialModel.ts — buildMaterialMaps, applyMaterialModel',
      'src/phase7/run.ts — runPhase7',
    ],
    mapBuild: {
      structure: 'blur(22px) − blur(48px) on source L, zero-mean',
      seam: 'crease/gradient confidence inside eroded upholstery, thresholded',
      micro: 'residual after structure/seam separation, zero-mean',
    },
    base6aUpholsteryMeanLab: baseLab,
    variants: variantResults,
    outputs: {
      grid: PHASE7_GRID,
      variants: PHASE7_VARIANTS.map((v) => phase7VariantPath(v.id)),
      structureMap: PHASE7_STRUCTURE_MAP,
      seamMap: PHASE7_SEAM_MAP,
      microMaterialMap: PHASE7_MICRO_MAP,
      spec: PHASE7_SPEC,
    },
    notes: [
      'No random noise, global sharpen, color remap, mask/alpha/edge/bottom changes.',
      'Does not use Phase 5/6/6C realism passes.',
    ],
  };

  writeFileSync(PHASE7_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: PHASE7_GRID, spec: PHASE7_SPEC, variants: variantResults, baseLab, maps };
}
