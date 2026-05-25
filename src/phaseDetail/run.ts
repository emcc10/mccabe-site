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
import { buildBottomGuard, buildOpenFieldMaterialWeight } from '../phase10/openFieldWeight.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import {
  calibrateAndApplyDetailTransfer,
  passesVisibleThreshold,
} from './applyDetailLayer.js';
import { detailFieldPreview, extractSwatchDetailLayers } from './swatchDetailExtract.js';
import { PHASE_DETAIL_VARIANTS, VISIBLE_THRESHOLD, type PhaseDetailVariant } from './spec.js';

export const PHASE_DETAIL_GRID = join(DEBUG_DIR, 'phaseDetail-grid.png');
export const PHASE_DETAIL_SPEC = join(DEBUG_DIR, 'phaseDetail-spec.json');
export const PHASE_DETAIL_METRICS = join(DEBUG_DIR, 'phaseDetail-metrics.json');
export const PHASE_DETAIL_SWATCH_DETAIL = join(DEBUG_DIR, 'phaseDetail-swatch-detail-map.png');
export const PHASE_DETAIL_COMPARE_6A = join(DEBUG_DIR, 'phaseDetail-compare-6a.png');
export const PHASE_DETAIL_DIFF_HEATMAP = join(DEBUG_DIR, 'phaseDetail-diff-heatmap.png');

export function phaseDetailVariantPath(id: string) {
  return join(DEBUG_DIR, `phaseDetail-variant-${id}.png`);
}

const LABEL_H = 44;

function labelSvg(text: string, width: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff">${text}</text>
    </svg>`,
  );
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

async function writeCompare6aVsBest(
  outPath: string,
  base6aPath: string,
  variantPath: string,
) {
  const panel = async (imagePath: string, label: string) => {
    const meta = await sharp(imagePath).metadata();
    const w = meta.width ?? 1;
    const h = meta.height ?? 1;
    const img = await sharp(imagePath).png().toBuffer();
    return sharp({
      create: { width: w, height: h + LABEL_H, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite([
        { input: img, top: 0, left: 0 },
        { input: labelSvg(label, w), top: h, left: 0 },
      ])
      .png()
      .toBuffer();
  };
  const panels = await Promise.all([panel(base6aPath, '6A BASE'), panel(variantPath, 'DETAIL TRANSFER')]);
  const metas = await Promise.all(panels.map((b) => sharp(b).metadata()));
  const maxH = Math.max(...metas.map((m) => m.height ?? 0), 1);
  const resized = await Promise.all(
    panels.map((buf, i) => {
      const w = metas[i].width ?? 1;
      const h = metas[i].height ?? 1;
      return sharp(buf).resize(Math.round((w * maxH) / h), maxH).toBuffer();
    }),
  );
  const widths = await Promise.all(resized.map((b) => sharp(b).metadata().then((m) => m.width ?? 0)));
  const totalW = widths.reduce((a, b) => a + b, 0);
  await sharp({
    create: { width: totalW, height: maxH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(
      resized.map((input, i) => ({
        input,
        left: widths.slice(0, i).reduce((a, b) => a + b, 0),
        top: 0,
      })),
    )
    .png()
    .toFile(outPath);
}

export async function runPhaseDetail() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const baseLab = meanUpholsteryLab(base6a, upholstery);

  const swatchImage = await loadImageRGBA(BALI_SILK_SWATCH);
  const layers = extractSwatchDetailLayers(swatchImage);
  const gates = buildSourceStructureGates(source, upholstery);
  const materialWeight = buildOpenFieldMaterialWeight(upholstery, gates, bottomGuard);

  await writeRgbPng(
    PHASE_DETAIL_SWATCH_DETAIL,
    layers.width,
    layers.height,
    detailFieldPreview(layers.combinedDetail, layers.width, layers.height),
  );

  const base6aPath = join(DEBUG_DIR, '_phaseDetail-base6a-tmp.png');
  await writeRgbaPng(base6aPath, base6a);

  const variantResults: {
    id: string;
    label: string;
    path: string;
    calibratedStrength: number;
    params: PhaseDetailVariant['params'];
    validationVs6a: ReturnType<typeof compareUpholsteryImages>['stats'] & {
      passesVisibleThreshold: boolean;
      verdict: string;
    };
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];
  let bestVariant: (typeof variantResults)[0] | null = null;

  for (const variant of PHASE_DETAIL_VARIANTS) {
    const { image, strength, validation } = calibrateAndApplyDetailTransfer(
      base6a,
      upholstery,
      layers,
      gates,
      materialWeight,
      variant.params,
    );
    const path = phaseDetailVariantPath(variant.id);
    await writeRgbaPng(path, image);

    const passes = passesVisibleThreshold(validation);
    const entry = {
      id: variant.id,
      label: variant.label,
      path,
      calibratedStrength: strength,
      params: variant.params,
      validationVs6a: {
        ...validation.stats,
        passesVisibleThreshold: passes,
        verdict: passes
          ? 'VISIBLE — meets mean |ΔL| and SSIM threshold vs 6A'
          : `FAIL — ${validation.verdict}`,
      },
    };
    variantResults.push(entry);

    if (!bestVariant || validation.stats.meanAbsDeltaL > bestVariant.validationVs6a.meanAbsDeltaL) {
      bestVariant = entry;
    }

    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `cal=${strength.toFixed(2)} ΔL=${validation.stats.meanAbsDeltaL.toFixed(2)}`,
    });
  }

  await writeVariantGrid(PHASE_DETAIL_GRID, gridPanels, 2);

  if (bestVariant) {
    const bestPath = phaseDetailVariantPath(bestVariant.id);
    const bestImg = await loadImageRGBA(bestPath);
    const cmp = compareUpholsteryImages(base6a, bestImg, upholstery);
    await writeCompare6aVsBest(PHASE_DETAIL_COMPARE_6A, base6aPath, bestPath);
    await writeRgbPng(PHASE_DETAIL_DIFF_HEATMAP, base6a.width, base6a.height, cmp.heatmapRgb);
  }

  const specBody = {
    phase: 'detail-transfer',
    purpose: 'Band-pass swatch detail + soft-light L modulation (replaces Phase 9/10 stochastic)',
    notFinalBaliSilk: true,
    abandoned: 'Phase 9/10 stochastic swatch sampling — proven trivial vs 6A',
    method: {
      extract: 'swatch LAB L: remove blur(32) color/lighting; grain=L-blur(4); mottle=blur(6)-blur(20)',
      apply: 'bilinear detail sample + soft-light/direct L blend; open-field weight; auto-calibrate strength',
      validation: VISIBLE_THRESHOLD,
    },
    lockedUnchanged: ['Stage 4B-v3', 'Phase 6A', 'masks, alpha, legs, edges'],
    variants: variantResults,
    base6aUpholsteryMeanLab: baseLab,
    anyPassesVisibleThreshold: variantResults.some((v) => v.validationVs6a.passesVisibleThreshold),
    outputs: {
      grid: PHASE_DETAIL_GRID,
      variants: PHASE_DETAIL_VARIANTS.map((v) => phaseDetailVariantPath(v.id)),
      swatchDetailMap: PHASE_DETAIL_SWATCH_DETAIL,
      compare6a: PHASE_DETAIL_COMPARE_6A,
      diffHeatmap: PHASE_DETAIL_DIFF_HEATMAP,
      spec: PHASE_DETAIL_SPEC,
      metrics: PHASE_DETAIL_METRICS,
    },
  };

  writeFileSync(PHASE_DETAIL_SPEC, JSON.stringify(specBody, null, 2));
  writeFileSync(PHASE_DETAIL_METRICS, JSON.stringify(specBody, null, 2));

  return { grid: PHASE_DETAIL_GRID, spec: PHASE_DETAIL_SPEC, variants: variantResults, baseLab, layers };
}
