import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import { bbox, erode, subtract } from '../phase1/masks.js';
import { BALI_SILK_SWATCH, DEBUG_DIR, REPO_ROOT } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import {
  boxBlur,
  buildLinearL,
  clamp,
  labToRgb,
  meanUpholsteryLab,
  rgbToLab,
} from '../phase5/labUtil.js';
import { writeVariantGrid } from '../phase3b/grid.js';
import { loadImageRGBA } from '../recolor/imageIO.js';
import { buildBottomGuard } from '../phase10/openFieldWeight.js';
import { cropSwatchCenter } from '../phase9/swatchMaps.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';

const DETAIL3_A_PATH = join(DEBUG_DIR, 'phaseDetail3-variant-A.png');
const REALISM_REFERENCE_PATH = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'Bali-Silk-realism-reference.png');

export const PHASE_REALLEATHER1_COMPARE_GRID = join(DEBUG_DIR, 'phaseRealLeather1-compare-grid.png');
export const PHASE_REALLEATHER1_SPEC = join(DEBUG_DIR, 'phaseRealLeather1-spec.json');

export function phaseRealLeather1VariantPath(id: string) {
  return join(DEBUG_DIR, `phaseRealLeather1-variant-${id}.png`);
}

interface VariantParams {
  id: 'A' | 'B';
  label: string;
  micrograinStrength: number;
  sheenStrength: number;
  contrastStrength: number;
  chromaBlend: number;
}

const VARIANTS: VariantParams[] = [
  {
    id: 'A',
    label: 'REALLEATHER-A',
    micrograinStrength: 0.48,
    sheenStrength: 1.9,
    contrastStrength: 0.65,
    chromaBlend: 0.075,
  },
  {
    id: 'B',
    label: 'REALLEATHER-B',
    micrograinStrength: 0.58,
    sheenStrength: 2.7,
    contrastStrength: 0.95,
    chromaBlend: 0.095,
  },
];

interface RealLeatherWeights {
  grain: Float32Array;
  sheen: Float32Array;
  contrast: Float32Array;
  form: Float32Array;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2d(x: number, y: number, seed: number): number {
  let h = Math.imul((x | 0) ^ (seed * 1597334677), 2246822519) ^ Math.imul((y | 0) ^ (seed * 3266489917), 668265263);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h / 0xffffffff) * 2 - 1;
}

function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const n00 = hash2d(x0, y0, seed);
  const n10 = hash2d(x1, y0, seed);
  const n01 = hash2d(x0, y1, seed);
  const n11 = hash2d(x1, y1, seed);
  const a = n00 * (1 - sx) + n10 * sx;
  const b = n01 * (1 - sx) + n11 * sx;
  return a * (1 - sy) + b * sy;
}

function normalizeStd(field: Float32Array): void {
  let sum = 0;
  for (const v of field) sum += v;
  const mean = sum / field.length;
  let varSum = 0;
  for (let i = 0; i < field.length; i++) {
    field[i] -= mean;
    varSum += field[i] * field[i];
  }
  const std = Math.sqrt(varSum / field.length) || 1e-6;
  for (let i = 0; i < field.length; i++) field[i] /= std;
}

function buildMicrograinField(width: number, height: number): Float32Array {
  const n = width * height;
  const field = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const n1 = valueNoise(x + 13.7, y - 9.1, 2.1, 11);
      const n2 = valueNoise(x * 1.07, y * 0.91, 3.3, 23);
      const n3 = valueNoise(x - 21.4, y + 17.9, 1.45, 37);
      field[j] = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    }
  }
  const blur = boxBlur(field, width, height, 2);
  for (let i = 0; i < n; i++) field[i] -= blur[i];
  normalizeStd(field);
  return field;
}

function computeSwatchMeanLab(swatch: RgbaImage): { meanA: number; meanB: number } {
  const patch = cropSwatchCenter(swatch);
  let sumA = 0;
  let sumB = 0;
  const n = patch.width * patch.height;
  for (let j = 0; j < n; j++) {
    const p = j * patch.channels;
    const lab = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]);
    sumA += lab.a;
    sumB += lab.b;
  }
  return { meanA: sumA / n, meanB: sumB / n };
}

function buildRealLeatherWeights(
  base6a: RgbaImage,
  source: RgbaImage,
  upholstery: Mask,
  bottomGuard: Mask,
): RealLeatherWeights {
  const { width, height, channels } = base6a;
  const n = width * height;
  const bb = bbox(upholstery);
  const grain = new Float32Array(n);
  const sheen = new Float32Array(n);
  const contrast = new Float32Array(n);
  const form = new Float32Array(n);
  if (!bb) return { grain, sheen, contrast, form };

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);
  const gates = buildSourceStructureGates(source, upholstery);

  const edgeMask = subtract(upholstery, erode(upholstery, 4));
  const edgeField = new Float32Array(n);
  for (let j = 0; j < n; j++) edgeField[j] = edgeMask.data[j] >= 128 ? 1 : 0;
  const edgeBlur = boxBlur(edgeField, width, height, 5);

  const baseL = buildLinearL(base6a);
  const blurNear = boxBlur(baseL, width, height, 6);
  const blurFar = boxBlur(baseL, width, height, 18);

  const openField = new Float32Array(n);
  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128 || bottomGuard.data[j] >= 128) continue;
      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;
      const inBack = yNorm < 0.5 && xNorm > 0.14 && xNorm < 0.86;
      const inArm = yNorm >= 0.14 && yNorm < 0.7 && (xNorm < 0.3 || xNorm > 0.7);
      const inSeat = yNorm >= 0.3 && yNorm < 0.62;
      const inRail = yNorm >= 0.5 && yNorm < 0.76 && xNorm > 0.1 && xNorm < 0.9;
      if (inBack || inArm || inSeat || inRail) openField[j] = 1;
    }
  }
  const openBlur = boxBlur(openField, width, height, 8);
  const seamBlur = boxBlur(gates.seamEdge, width, height, 5);
  const sheenBlur = boxBlur(gates.highlight, width, height, 9);

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(base6a.data[p], base6a.data[p + 1], base6a.data[p + 2]);
    const y = (j / width) | 0;
    const yNorm = (y - bb.minY) / spanY;
    const backFactor = yNorm < 0.48 ? 0.58 : 1;
    const midtone = smoothstep(56, 64, lab.L) * (1 - smoothstep(78, 86, lab.L));
    const seamSuppress = 1 - seamBlur[j] * 0.96;
    const highlightSuppress = 1 - gates.highlight[j] * 0.82;
    const edgeSuppress = 1 - edgeBlur[j] * 0.95;

    grain[j] = clamp(openBlur[j], 0, 1) * backFactor * midtone * seamSuppress * highlightSuppress * edgeSuppress;

    const sheenBase = clamp(sheenBlur[j], 0, 1) * (0.4 + 0.6 * clamp(openBlur[j], 0, 1));
    sheen[j] = sheenBase * (1 - seamBlur[j] * 0.55) * (1 - edgeBlur[j] * 0.45);

    const signedForm = clamp((blurNear[j] - blurFar[j]) / 6, -1, 1);
    const curvature = Math.abs(signedForm);
    form[j] = signedForm;
    contrast[j] =
      clamp(openBlur[j], 0, 1) *
      curvature *
      (0.35 + 0.65 * clamp(seamBlur[j], 0, 1)) *
      (1 - gates.highlight[j] * 0.45) *
      edgeSuppress;
  }

  return { grain, sheen, contrast, form };
}

function applyRealLeatherFinish(
  base6a: RgbaImage,
  upholstery: Mask,
  weights: RealLeatherWeights,
  micrograin: Float32Array,
  swatchMean: { meanA: number; meanB: number },
  params: VariantParams,
  baseMeanLab: { meanA: number; meanB: number },
): RgbaImage {
  const out = Buffer.from(base6a.data);
  const { width, height, channels } = base6a;
  const deltaA = swatchMean.meanA - baseMeanLab.meanA;
  const deltaB = swatchMean.meanB - baseMeanLab.meanB;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(base6a.data[p], base6a.data[p + 1], base6a.data[p + 2]);

    const grainDelta =
      Math.tanh(micrograin[j] * 1.2) * 1.1 * params.micrograinStrength * weights.grain[j];
    const sheenDelta =
      params.sheenStrength * weights.sheen[j] * 1.2 * (0.2 + 0.8 * clamp((lab.L - 58) / 24, 0, 1));
    const contrastDelta =
      params.contrastStrength * weights.contrast[j] * weights.form[j] * 3.2;
    let L = lab.L + grainDelta + sheenDelta + contrastDelta;

    const a = lab.a + params.chromaBlend * deltaA;
    const b = lab.b + params.chromaBlend * deltaB;
    const rgb = labToRgb(L, a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = base6a.data[p + 3];
  }

  return { data: out, width, height, channels };
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

async function panelWithLabel(imagePath: string, label: string): Promise<Buffer> {
  const LABEL_H = 44;
  const meta = await sharp(imagePath).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const img = await sharp(imagePath).png().toBuffer();
  const labelSvg = Buffer.from(
    `<svg width="${w}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#fff">${label}</text>
    </svg>`,
  );
  return sharp({
    create: { width: w, height: h + LABEL_H, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: img, top: 0, left: 0 },
      { input: labelSvg, top: h, left: 0 },
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
  await sharp({
    create: { width: cellW * panels.length, height: cellH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(resized.map((input, i) => ({ input, left: i * cellW, top: 0 })))
    .png()
    .toFile(outPath);
}

export async function runPhaseRealLeather1() {
  const { source, image: base6a, upholstery, lower12 } = await buildPhase6aBase();
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const swatch = await loadImageRGBA(BALI_SILK_SWATCH);
  const swatchMean = computeSwatchMeanLab(swatch);
  const baseMeanLab = meanUpholsteryLab(base6a, upholstery);

  const weights = buildRealLeatherWeights(base6a, source, upholstery, bottomGuard);
  const micrograin = buildMicrograinField(base6a.width, base6a.height);

  const results: {
    id: string;
    label: string;
    path: string;
    params: Omit<VariantParams, 'id' | 'label'>;
    vs6a: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsDetail3A: ReturnType<typeof compareUpholsteryImages>['stats'] | null;
    meanLab: { meanL: number; meanA: number; meanB: number; count: number };
  }[] = [];

  const gridPanels: { imagePath: string; title: string; settings: string }[] = [];

  let detail3A: RgbaImage | null = null;
  try {
    detail3A = await loadImageRGBA(DETAIL3_A_PATH);
  } catch {
    detail3A = null;
  }

  const base6aTmp = join(DEBUG_DIR, '_phaseRealLeather1-base6a.png');
  await writeRgbaPng(base6aTmp, base6a);

  for (const variant of VARIANTS) {
    const image = applyRealLeatherFinish(base6a, upholstery, weights, micrograin, swatchMean, variant, baseMeanLab);
    const path = phaseRealLeather1VariantPath(variant.id);
    await writeRgbaPng(path, image);

    const vs6a = compareUpholsteryImages(base6a, image, upholstery).stats;
    const vsDetail3A = detail3A ? compareUpholsteryImages(detail3A, image, upholstery).stats : null;
    const meanLab = meanUpholsteryLab(image, upholstery);
    results.push({
      id: variant.id,
      label: variant.label,
      path,
      params: {
        micrograinStrength: variant.micrograinStrength,
        sheenStrength: variant.sheenStrength,
        contrastStrength: variant.contrastStrength,
        chromaBlend: variant.chromaBlend,
      },
      vs6a,
      vsDetail3A,
      meanLab,
    });

    gridPanels.push({
      imagePath: path,
      title: variant.label,
      settings: `grain=${variant.micrograinStrength} sheen=${variant.sheenStrength} contrast=${variant.contrastStrength}`,
    });
  }

  await writeVariantGrid(join(DEBUG_DIR, 'phaseRealLeather1-grid.png'), gridPanels, 2);

  const comparePanels = [
    { path: base6aTmp, label: '6A' },
    { path: DETAIL3_A_PATH, label: 'DETAIL3-A' },
    { path: phaseRealLeather1VariantPath('A'), label: 'REALLEATHER-A' },
    { path: phaseRealLeather1VariantPath('B'), label: 'REALLEATHER-B' },
  ];
  await writeCompareGrid(PHASE_REALLEATHER1_COMPARE_GRID, comparePanels);

  const body = {
    phase: 'RealLeather1',
    purpose: 'Smooth photoreal leather finish from 6A base — no visible swatch detail transfer',
    notFinalBaliSilk: true,
    base: 'Phase 6A only',
    referenceImage: REALISM_REFERENCE_PATH,
    removedFromPipeline: [
      'band-pass swatch mottle transfer',
      'L - blur swatch detail transfer',
      'soft-light swatch detail layer',
      'per-panel stamped UV texture',
      'visible texture map surviving at product-view size',
    ],
    method: {
      luminance: 'Preserve existing 6A/source form shading, highlights, seams, edges',
      swatch: 'Average Bali Silk a/b only; no swatch grain/lighting/fold used as texture',
      micrograin: 'Very subtle deterministic high-frequency procedural field, high-pass only',
      sheen: 'Broad soft highlight lift following existing highlight geography',
      localContrast: 'Gentle source-form-aware contrast, no random field darkening',
    },
    swatchMeanLab: swatchMean,
    base6aMeanLab: baseMeanLab,
    outputs: {
      variants: [phaseRealLeather1VariantPath('A'), phaseRealLeather1VariantPath('B')],
      compareGrid: PHASE_REALLEATHER1_COMPARE_GRID,
      spec: PHASE_REALLEATHER1_SPEC,
    },
    variants: results,
  };

  writeFileSync(PHASE_REALLEATHER1_SPEC, JSON.stringify(body, null, 2));
  return { compareGrid: PHASE_REALLEATHER1_COMPARE_GRID, spec: PHASE_REALLEATHER1_SPEC, results };
}
