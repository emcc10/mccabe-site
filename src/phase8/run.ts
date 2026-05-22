import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { buildLower12Region } from '../phase6a/bottomSeam.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { DEBUG_DIR } from '../phase1/paths.js';
import { dilate, intersect } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import {
  applyFreqMaterial,
  buildFreqLayers,
  freqLayerToPreviewBuffer,
  highConfidenceMaskToRgb,
} from './freqMaterial.js';
import { PHASE8_VARIANTS, type Phase8Variant } from './spec.js';

export const PHASE8_GRID = join(DEBUG_DIR, 'phase8-grid.png');
export const PHASE8_SPEC = join(DEBUG_DIR, 'phase8-spec.json');
export const PHASE8_LOW_LAYER = join(DEBUG_DIR, 'phase8-low-layer.png');
export const PHASE8_MID_LAYER = join(DEBUG_DIR, 'phase8-mid-layer.png');
export const PHASE8_HIGH_LAYER = join(DEBUG_DIR, 'phase8-high-layer.png');
export const PHASE8_HIGH_CONF_MASK = join(DEBUG_DIR, 'phase8-high-confidence-mask.png');

export function phase8VariantPath(id: string) {
  return join(DEBUG_DIR, `phase8-variant-${id}.png`);
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

export async function runPhase8() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = intersect(dilate(lower12, 6), upholstery);
  const baseLab = meanUpholsteryLab(base6a, upholstery);
  const layers = buildFreqLayers(source, upholstery);
  const { width, height } = source;

  await writeRgbPng(
    PHASE8_LOW_LAYER,
    width,
    height,
    freqLayerToPreviewBuffer(layers.low, upholstery, width, height),
  );
  await writeRgbPng(
    PHASE8_MID_LAYER,
    width,
    height,
    freqLayerToPreviewBuffer(layers.mid, upholstery, width, height),
  );
  await writeRgbPng(
    PHASE8_HIGH_LAYER,
    width,
    height,
    freqLayerToPreviewBuffer(layers.high, upholstery, width, height),
  );
  await writeRgbPng(
    PHASE8_HIGH_CONF_MASK,
    width,
    height,
    highConfidenceMaskToRgb(layers.highConfidence, upholstery, width, height),
  );

  const variantResults: {
    id: string;
    label: string;
    path: string;
    params: Phase8Variant['params'];
    meanL: number;
    deltaLFrom6a: number;
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE8_VARIANTS) {
    const out = applyFreqMaterial(base6a, upholstery, layers, variant.params, bottomGuard);
    const path = phase8VariantPath(variant.id);
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
      settings: `mid=${p.midStrength} high=${p.highStrength} conf%=${p.highConfidencePercentile}`,
    });
  }

  await writeVariantGrid(PHASE8_GRID, gridPanels, 2);

  const specBody = {
    phase: 8,
    purpose: 'Frequency-separated material recovery — replaces Phase 7 realism method',
    notFinalBaliSilk: true,
    input: 'Stage 4B-v3 color + Phase 6A bottom seam fix (no Phase 7/7C stack)',
    method: {
      source: 'original cognac source LAB L only',
      low: `boxBlur(${22}px) zero-mean — broad form`,
      mid: `boxBlur(${5}px) − boxBlur(${22}px) zero-mean — leather body`,
      high: `sourceL − boxBlur(${5}px) zero-mean — fine residual`,
      highGate: 'crease/gradient confidence; not applied on flat cushion fields',
      bottomGuard: 'dilated lower-12% band reduces mid/high strength (preserve 6A seam)',
    },
    lockedUnchanged: [
      'Stage 4B-v3 color mapping',
      'Phase 6A bottom seam fix',
      'masks, alpha, leg restore, edge cleanup',
    ],
    replaced: 'Phase 7 / 7C material model (hit realism ceiling)',
    variants: PHASE8_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      intent: v.intent,
      params: v.params,
    })),
    results: variantResults,
    base6aUpholsteryMeanLab: baseLab,
    outputs: {
      grid: PHASE8_GRID,
      variants: PHASE8_VARIANTS.map((v) => phase8VariantPath(v.id)),
      lowLayer: PHASE8_LOW_LAYER,
      midLayer: PHASE8_MID_LAYER,
      highLayer: PHASE8_HIGH_LAYER,
      highConfidenceMask: PHASE8_HIGH_CONF_MASK,
      spec: PHASE8_SPEC,
    },
    restrictions: [
      'No color remap, mask/alpha/edge changes, random noise, global sharpen',
      'No whole-sofa darken; high layer gated to seams/creases/edges',
    ],
  };

  writeFileSync(PHASE8_SPEC, JSON.stringify(specBody, null, 2));

  return { grid: PHASE8_GRID, spec: PHASE8_SPEC, variants: variantResults, baseLab, layers };
}
