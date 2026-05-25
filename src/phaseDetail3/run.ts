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
import { buildPanelWarpContext } from '../phaseDetail2/panelUV.js';
import { calibrateDetail3 } from './applyDetailLayer3.js';
import { extractFineGrainLayers } from './fineGrainExtract.js';
import { buildBottomGuard, buildFineGrainFieldWeight } from './fineFieldWeight.js';
import { PHASE_DETAIL3_VARIANTS } from './spec.js';

export const PHASE_DETAIL3_COMPARE_GRID = join(DEBUG_DIR, 'phaseDetail3-compare-grid.png');
export const PHASE_DETAIL3_HEATMAP = join(DEBUG_DIR, 'phaseDetail3-heatmap.png');
export const PHASE_DETAIL3_SPEC = join(DEBUG_DIR, 'phaseDetail3-spec.json');

const REF_DETAIL2_A = join(DEBUG_DIR, 'phaseDetail2-variant-A.png');

export function phaseDetail3VariantPath(id: string) {
  return join(DEBUG_DIR, `phaseDetail3-variant-${id}.png`);
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

async function writeCompareGrid(outPath: string, panels: { path: string; label: string }[]) {
  const labeled = await Promise.all(panels.map((p) => panelWithLabel(p.path, p.label)));
  const metas = await Promise.all(labeled.map((b) => sharp(b).metadata()));
  const cellW = Math.max(...metas.map((m) => m.width ?? 0));
  const cellH = Math.max(...metas.map((m) => m.height ?? 0));
  const resized = await Promise.all(
    labeled.map((buf) =>
      sharp(buf).resize(cellW, cellH, { fit: 'contain', background: '#ffffff' }).png().toBuffer(),
    ),
  );
  const cols = panels.length;
  await sharp({
    create: { width: cellW * cols, height: cellH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(
      resized.map((input, i) => ({ input, left: i * cellW, top: 0 })),
    )
    .png()
    .toFile(outPath);
}

export async function runPhaseDetail3() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const gates = buildSourceStructureGates(source, upholstery);
  const { weight, backScale } = buildFineGrainFieldWeight(base6a, upholstery, gates, bottomGuard);
  const panelCtx = buildPanelWarpContext(upholstery);

  const swatchImage = await loadImageRGBA(BALI_SILK_SWATCH);
  const layers = extractFineGrainLayers(swatchImage);

  const base6aTmp = join(DEBUG_DIR, '_phaseDetail3-base6a-tmp.png');
  await writeRgbaPng(base6aTmp, base6a);

  const variantResults: {
    id: string;
    label: string;
    path: string;
    calibratedStrength: number;
    params: (typeof PHASE_DETAIL3_VARIANTS)[number]['params'];
    vs6a: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsDetail2A: ReturnType<typeof compareUpholsteryImages>['stats'] | null;
  }[] = [];

  for (const variant of PHASE_DETAIL3_VARIANTS) {
    const { image, strength, validation } = calibrateDetail3(
      base6a,
      upholstery,
      layers,
      weight,
      backScale,
      variant.params,
      panelCtx,
    );
    const path = phaseDetail3VariantPath(variant.id);
    await writeRgbaPng(path, image);

    let vsDetail2A = null;
    try {
      const d2a = await loadImageRGBA(REF_DETAIL2_A);
      vsDetail2A = compareUpholsteryImages(d2a, image, upholstery).stats;
    } catch {
      /* missing */
    }

    variantResults.push({
      id: variant.id,
      label: variant.label,
      path,
      calibratedStrength: strength,
      params: variant.params,
      vs6a: validation.stats,
      vsDetail2A,
    });
  }

  const comparePanels: { path: string; label: string }[] = [
    { path: base6aTmp, label: '6A BASE' },
  ];
  for (const ref of [
    { path: REF_DETAIL2_A, label: 'DETAIL2-A' },
    { path: phaseDetail3VariantPath('A'), label: 'DETAIL3-A' },
    { path: phaseDetail3VariantPath('B'), label: 'DETAIL3-B' },
  ]) {
    try {
      await sharp(ref.path).metadata();
      comparePanels.push(ref);
    } catch {
      /* skip */
    }
  }

  await writeCompareGrid(PHASE_DETAIL3_COMPARE_GRID, comparePanels);

  const detail3a = await loadImageRGBA(phaseDetail3VariantPath('A'));
  const heatCmp = compareUpholsteryImages(base6a, detail3a, upholstery);
  await writeRgbPng(PHASE_DETAIL3_HEATMAP, base6a.width, base6a.height, heatCmp.heatmapRgb);

  const specBody = {
    phase: 'detail3',
    purpose: 'Fine-grain dominant — remove cloudy mottle from DETAIL2-A base',
    notFinalBaliSilk: true,
    basedOn: 'DETAIL2-A (not DETAIL2-B or DETAIL-B)',
    changes: {
      grainExtract: 'L - blur(2px) high-pass',
      mottleMix: '0.04–0.05 (was 0.10); extraction damped 82%',
      backTextureScale: '58% on upper back panels',
      seamSuppress: 'expanded feather blur on seam map',
      cushionBreakSuppress: 'horizontal band y 40–60% feathered',
      detailGain: 'tanh×1.15 cap 0.68',
      maxDeltaL: '2.3–2.45',
      targetMeanDeltaL: '0.60–0.68 vs 6A',
    },
    variants: variantResults,
    validationNote: 'Not declared better unless less cloudy/embossed AND less flat than 6A — review compare grid',
    outputs: {
      compareGrid: PHASE_DETAIL3_COMPARE_GRID,
      heatmapVs6a: PHASE_DETAIL3_HEATMAP,
      variants: PHASE_DETAIL3_VARIANTS.map((v) => phaseDetail3VariantPath(v.id)),
      spec: PHASE_DETAIL3_SPEC,
    },
  };

  writeFileSync(PHASE_DETAIL3_SPEC, JSON.stringify(specBody, null, 2));

  return { spec: PHASE_DETAIL3_SPEC, variants: variantResults, compareGrid: PHASE_DETAIL3_COMPARE_GRID };
}
