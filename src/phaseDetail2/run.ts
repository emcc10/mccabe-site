import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { buildLower12Region } from '../phase6a/bottomSeam.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { BALI_SILK_SWATCH, DEBUG_DIR } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { loadImageRGBA } from '../recolor/imageIO.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { extractSwatchDetailLayers } from '../phaseDetail/swatchDetailExtract.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import { calibrateDetail2, isLessFlatThan6a } from './applyDetailLayer2.js';
import { buildBottomGuard, buildMidtoneFieldWeight } from './midtoneFieldWeight.js';
import { PHASE_DETAIL2_VARIANTS } from './spec.js';
import { buildPanelWarpContext } from './panelUV.js';

export const PHASE_DETAIL2_GRID = join(DEBUG_DIR, 'phaseDetail2-grid.png');
export const PHASE_DETAIL2_COMPARE_GRID = join(DEBUG_DIR, 'phaseDetail2-compare-grid.png');
export const PHASE_DETAIL2_HEATMAP = join(DEBUG_DIR, 'phaseDetail2-heatmap.png');
export const PHASE_DETAIL2_SPEC = join(DEBUG_DIR, 'phaseDetail2-spec.json');

const REF_6A = join(DEBUG_DIR, 'phase6a-single.png');
const REF_DETAIL_A = join(DEBUG_DIR, 'phaseDetail-variant-A.png');
const REF_DETAIL_B = join(DEBUG_DIR, 'phaseDetail-variant-B.png');

export function phaseDetail2VariantPath(id: string) {
  return join(DEBUG_DIR, `phaseDetail2-variant-${id}.png`);
}

const LABEL_H = 40;

function labelSvg(text: string, width: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#fff">${text}</text>
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

async function panelWithLabel(imagePath: string, label: string): Promise<Buffer> {
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
}

async function writeMultiPanelGrid(
  outPath: string,
  panels: { path: string; label: string }[],
  cols: number,
) {
  const labeled = await Promise.all(panels.map((p) => panelWithLabel(p.path, p.label)));
  const metas = await Promise.all(labeled.map((b) => sharp(b).metadata()));
  const cellW = Math.max(...metas.map((m) => m.width ?? 0));
  const cellH = Math.max(...metas.map((m) => m.height ?? 0));
  const resized = await Promise.all(
    labeled.map((buf) =>
      sharp(buf).resize(cellW, cellH, { fit: 'contain', background: '#ffffff' }).png().toBuffer(),
    ),
  );
  const rows = Math.ceil(panels.length / cols);
  const gridW = cellW * cols;
  const gridH = cellH * rows;
  await sharp({
    create: { width: gridW, height: gridH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(
      resized.map((input, i) => ({
        input,
        left: (i % cols) * cellW,
        top: Math.floor(i / cols) * cellH,
      })),
    )
    .png()
    .toFile(outPath);
}

export async function runPhaseDetail2() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const gates = buildSourceStructureGates(source, upholstery);
  const weight = buildMidtoneFieldWeight(base6a, upholstery, gates, bottomGuard);

  const swatchImage = await loadImageRGBA(BALI_SILK_SWATCH);
  const layers = extractSwatchDetailLayers(swatchImage);
  const panelCtx = buildPanelWarpContext(upholstery);

  const base6aTmp = join(DEBUG_DIR, '_phaseDetail2-base6a-tmp.png');
  await writeRgbaPng(base6aTmp, base6a);

  const variantResults: {
    id: string;
    label: string;
    path: string;
    calibratedStrength: number;
    params: (typeof PHASE_DETAIL2_VARIANTS)[number]['params'];
    vs6a: ReturnType<typeof compareUpholsteryImages>['stats'] & { lessFlatThan6a: boolean };
    vsDetailA: ReturnType<typeof compareUpholsteryImages>['stats'];
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  for (const variant of PHASE_DETAIL2_VARIANTS) {
    const { image, strength, validation } = calibrateDetail2(
      base6a,
      upholstery,
      layers,
      weight,
      variant.params,
      panelCtx,
    );
    const path = phaseDetail2VariantPath(variant.id);
    await writeRgbaPng(path, image);

    let vsDetailA = validation.stats;
    try {
      const detailA = await loadImageRGBA(REF_DETAIL_A);
      vsDetailA = compareUpholsteryImages(detailA, image, upholstery).stats;
    } catch {
      /* detail A missing */
    }

    variantResults.push({
      id: variant.id,
      label: variant.label,
      path,
      calibratedStrength: strength,
      params: variant.params,
      vs6a: {
        ...validation.stats,
        lessFlatThan6a: isLessFlatThan6a(validation),
      },
      vsDetailA,
    });

    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `ΔL=${validation.stats.meanAbsDeltaL.toFixed(2)} cap=${variant.params.maxDeltaL}`,
    });
  }

  await writeVariantGrid(PHASE_DETAIL2_GRID, gridPanels, 2);

  const comparePanels: { path: string; label: string }[] = [
    { path: base6aTmp, label: '6A BASE' },
  ];
  for (const ref of [
    { path: REF_DETAIL_A, label: 'DETAIL-A' },
    { path: REF_DETAIL_B, label: 'DETAIL-B' },
    { path: phaseDetail2VariantPath('A'), label: 'DETAIL2-A' },
    { path: phaseDetail2VariantPath('B'), label: 'DETAIL2-B' },
  ]) {
    try {
      await sharp(ref.path).metadata();
      comparePanels.push(ref);
    } catch {
      /* skip missing */
    }
  }

  await writeMultiPanelGrid(PHASE_DETAIL2_COMPARE_GRID, comparePanels, 3);

  const best2a = await loadImageRGBA(phaseDetail2VariantPath('A'));
  const heatCmp = compareUpholsteryImages(base6a, best2a, upholstery);
  await writeRgbPng(PHASE_DETAIL2_HEATMAP, base6a.width, base6a.height, heatCmp.heatmapRgb);

  const cmpDetailA = variantResults[0]?.vsDetailA;
  const specBody = {
    phase: 'detail2',
    purpose: 'Reduce embossing/dirty look; keep subtle grain in midtone open fields',
    notFinalBaliSilk: true,
    basedOn: 'DETAIL-A (not DETAIL-B)',
    changesFromDetailA: {
      targetMeanDeltaL: '1.0 → 0.75–0.80',
      directLScale: '2.8 → ~1.15–1.28 (~55% reduction)',
      mottleMix: '0.38 → 0.10–0.12 (~70% reduction)',
      grainMix: '0.62 → 0.77–0.85',
      maxDeltaLCap: '2.6–2.8 per pixel',
      midtoneOnlyWeight: true,
      panelUVWarp: true,
      detailGainCurve: 'tanh soft-clip',
    },
    variants: variantResults,
    validationNote:
      'Not declared better unless visually less dirty/embossed AND less flat than 6A — review compare grid',
    references: {
      base6a: REF_6A,
      detailA: REF_DETAIL_A,
      detailB: REF_DETAIL_B,
    },
    outputs: {
      grid: PHASE_DETAIL2_GRID,
      compareGrid: PHASE_DETAIL2_COMPARE_GRID,
      heatmapVs6a: PHASE_DETAIL2_HEATMAP,
      variants: PHASE_DETAIL2_VARIANTS.map((v) => phaseDetail2VariantPath(v.id)),
      spec: PHASE_DETAIL2_SPEC,
    },
    detail2A_vs_detailA: cmpDetailA,
  };

  writeFileSync(PHASE_DETAIL2_SPEC, JSON.stringify(specBody, null, 2));

  return { spec: PHASE_DETAIL2_SPEC, variants: variantResults, compareGrid: PHASE_DETAIL2_COMPARE_GRID };
}
