import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, erode, intersect, subtract, union } from '../phase1/masks.js';
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
import { loadImageRGBA } from '../recolor/imageIO.js';
import { cropSwatchCenter } from '../phase9/swatchMaps.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';

const REALISM_REFERENCE_PATH = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'Bali-Silk-realism-reference.png');
const DETAIL3_A_PATH = join(DEBUG_DIR, 'phaseDetail3-variant-A.png');
const REALLEATHER_B_PATH = join(DEBUG_DIR, 'phaseRealLeather1-variant-B.png');

export const PHASE_REALLEATHER2_COMPARE_GRID = join(DEBUG_DIR, 'phaseRealLeather2-compare-grid.png');
export const PHASE_REALLEATHER2_SPEC = join(DEBUG_DIR, 'phaseRealLeather2-spec.json');

export function phaseRealLeather2VariantPath(id: string) {
  return join(DEBUG_DIR, `phaseRealLeather2-variant-${id}.png`);
}

interface VariantParams {
  id: 'A' | 'B';
  label: string;
  micrograinStrength: number;
  sheenStrength: number;
  contrastStrength: number;
  chromaBlend: number;
  warmHighlightTint: number;
}

const VARIANTS: VariantParams[] = [
  {
    id: 'A',
    label: 'REALLEATHER2-A',
    micrograinStrength: 0.5,
    sheenStrength: 4.0,
    contrastStrength: 1.25,
    chromaBlend: 0.11,
    warmHighlightTint: 0.28,
  },
  {
    id: 'B',
    label: 'REALLEATHER2-B',
    micrograinStrength: 0.58,
    sheenStrength: 5.0,
    contrastStrength: 1.55,
    chromaBlend: 0.13,
    warmHighlightTint: 0.36,
  },
];

interface FinishWeights {
  micrograin: Float32Array;
  sheen: Float32Array;
  formLift: Float32Array;
  formPocket: Float32Array;
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
      const n1 = valueNoise(x + 7.2, y - 5.3, 1.9, 17);
      const n2 = valueNoise(x * 1.03, y * 0.97, 2.7, 29);
      const n3 = valueNoise(x - 15.6, y + 11.8, 1.25, 43);
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
  const n = patch.width * patch.height;
  let sumA = 0;
  let sumB = 0;
  for (let j = 0; j < n; j++) {
    const p = j * patch.channels;
    const lab = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]);
    sumA += lab.a;
    sumB += lab.b;
  }
  return { meanA: sumA / n, meanB: sumB / n };
}

function buildBottomGuard(upholstery: Mask, lower12: Mask): Mask {
  const bb = bbox(upholstery);
  if (!bb) return { data: new Uint8Array(upholstery.width * upholstery.height), width: upholstery.width, height: upholstery.height };
  const bottom = { data: new Uint8Array(upholstery.width * upholstery.height), width: upholstery.width, height: upholstery.height };
  const yStart = bb.minY + Math.floor((bb.maxY - bb.minY + 1) * 0.84);
  for (let y = yStart; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * upholstery.width + x;
      if (upholstery.data[j] >= 128) bottom.data[j] = 255;
    }
  }
  return union(intersect(dilate(lower12, 6), upholstery), bottom);
}

function buildFinishWeights(
  base6a: RgbaImage,
  source: RgbaImage,
  upholstery: Mask,
  bottomGuard: Mask,
): FinishWeights {
  const { width, height, channels } = base6a;
  const n = width * height;
  const bb = bbox(upholstery);
  const micrograin = new Float32Array(n);
  const sheen = new Float32Array(n);
  const formLift = new Float32Array(n);
  const formPocket = new Float32Array(n);
  if (!bb) return { micrograin, sheen, formLift, formPocket };

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);
  const gates = buildSourceStructureGates(source, upholstery);

  const edgeMask = subtract(upholstery, erode(upholstery, 4));
  const edgeField = new Float32Array(n);
  for (let j = 0; j < n; j++) edgeField[j] = edgeMask.data[j] >= 128 ? 1 : 0;
  const edgeBlur = boxBlur(edgeField, width, height, 5);
  const seamWide = boxBlur(gates.seamEdge, width, height, 8);
  const highlightWide = boxBlur(gates.highlight, width, height, 14);

  const baseL = buildLinearL(base6a);
  const blurNear = boxBlur(baseL, width, height, 6);
  const blurFar = boxBlur(baseL, width, height, 22);

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

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(base6a.data[p], base6a.data[p + 1], base6a.data[p + 2]);
    const y = (j / width) | 0;
    const yNorm = (y - bb.minY) / spanY;
    const backFactor = yNorm < 0.48 ? 0.72 : 1;
    const midtone = smoothstep(56, 64, lab.L) * (1 - smoothstep(80, 88, lab.L));
    const edgeSuppress = 1 - edgeBlur[j] * 0.96;
    const seamSuppress = 1 - seamWide[j] * 0.95;
    const highlightSuppress = 1 - gates.highlight[j] * 0.92;

    micrograin[j] =
      clamp(openBlur[j], 0, 1) *
      backFactor *
      midtone *
      seamSuppress *
      highlightSuppress *
      edgeSuppress;

    const signedForm = clamp((blurNear[j] - blurFar[j]) / 6.5, -1, 1);
    const lift = clamp(signedForm, 0, 1);
    const pocket = clamp(-signedForm, 0, 1);

    sheen[j] =
      clamp(openBlur[j], 0, 1) *
      (0.35 + 0.65 * highlightWide[j]) *
      (0.55 + 0.45 * lift) *
      (1 - seamWide[j] * 0.4) *
      (1 - edgeBlur[j] * 0.35);

    formLift[j] =
      clamp(openBlur[j], 0, 1) *
      lift *
      (0.35 + 0.65 * smoothstep(60, 78, lab.L)) *
      (1 - seamWide[j] * 0.25) *
      edgeSuppress;

    formPocket[j] =
      clamp(openBlur[j], 0, 1) *
      pocket *
      (0.45 + 0.55 * seamWide[j]) *
      (1 - gates.highlight[j] * 0.45) *
      edgeSuppress;
  }

  return { micrograin, sheen, formLift, formPocket };
}

function applyRealLeather2(
  realLeatherB: RgbaImage,
  base6a: RgbaImage,
  upholstery: Mask,
  weights: FinishWeights,
  micrograinField: Float32Array,
  swatchMean: { meanA: number; meanB: number },
  baseMeanLab: { meanA: number; meanB: number },
  params: VariantParams,
): RgbaImage {
  const out = Buffer.from(realLeatherB.data);
  const { width, height, channels } = realLeatherB;
  const deltaA = swatchMean.meanA - baseMeanLab.meanA;
  const deltaB = swatchMean.meanB - baseMeanLab.meanB;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(realLeatherB.data[p], realLeatherB.data[p + 1], realLeatherB.data[p + 2]);

    const grainDelta =
      Math.tanh(micrograinField[j] * 1.25) *
      0.55 *
      params.micrograinStrength *
      weights.micrograin[j];

    const sheenDelta =
      params.sheenStrength *
      0.28 *
      weights.sheen[j] *
      (0.28 + 0.72 * clamp((lab.L - 56) / 24, 0, 1));

    const formDelta =
      params.contrastStrength * 0.72 * weights.formLift[j] -
      params.contrastStrength * 0.48 * weights.formPocket[j];

    let L = lab.L + grainDelta + sheenDelta + formDelta;
    const dL = clamp(L - lab.L, -2.8, 3.4);
    L = lab.L + dL;

    const warmMask = clamp(weights.sheen[j] * (0.25 + 0.75 * clamp((lab.L - 60) / 20, 0, 1)), 0, 1);
    const a = lab.a + params.chromaBlend * deltaA - params.warmHighlightTint * 0.06 * warmMask;
    const b = lab.b + params.chromaBlend * deltaB + params.warmHighlightTint * 0.22 * warmMask;

    const rgb = labToRgb(L, a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = realLeatherB.data[p + 3];
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

export async function runPhaseRealLeather2() {
  const { source, image: base6a, upholstery, lower12 } = await buildPhase6aBase();
  const realLeatherB = await loadImageRGBA(REALLEATHER_B_PATH);
  const swatch = await loadImageRGBA(BALI_SILK_SWATCH);
  const swatchMean = computeSwatchMeanLab(swatch);
  const baseMeanLab = meanUpholsteryLab(base6a, upholstery);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const weights = buildFinishWeights(base6a, source, upholstery, bottomGuard);
  const micrograin = buildMicrograinField(base6a.width, base6a.height);

  const detail3A = await loadImageRGBA(DETAIL3_A_PATH);
  const base6aTmp = join(DEBUG_DIR, '_phaseRealLeather2-base6a.png');
  await writeRgbaPng(base6aTmp, base6a);

  const results: {
    id: string;
    label: string;
    path: string;
    params: Omit<VariantParams, 'id' | 'label'>;
    vs6a: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsDetail3A: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsRealLeatherB: ReturnType<typeof compareUpholsteryImages>['stats'];
    meanLab: { meanL: number; meanA: number; meanB: number; count: number };
  }[] = [];

  for (const variant of VARIANTS) {
    const image = applyRealLeather2(realLeatherB, base6a, upholstery, weights, micrograin, swatchMean, baseMeanLab, variant);
    const path = phaseRealLeather2VariantPath(variant.id);
    await writeRgbaPng(path, image);

    results.push({
      id: variant.id,
      label: variant.label,
      path,
      params: {
        micrograinStrength: variant.micrograinStrength,
        sheenStrength: variant.sheenStrength,
        contrastStrength: variant.contrastStrength,
        chromaBlend: variant.chromaBlend,
        warmHighlightTint: variant.warmHighlightTint,
      },
      vs6a: compareUpholsteryImages(base6a, image, upholstery).stats,
      vsDetail3A: compareUpholsteryImages(detail3A, image, upholstery).stats,
      vsRealLeatherB: compareUpholsteryImages(realLeatherB, image, upholstery).stats,
      meanLab: meanUpholsteryLab(image, upholstery),
    });
  }

  await writeCompareGrid(PHASE_REALLEATHER2_COMPARE_GRID, [
    { path: base6aTmp, label: '6A' },
    { path: DETAIL3_A_PATH, label: 'DETAIL3-A' },
    { path: REALLEATHER_B_PATH, label: 'REALLEATHER-B' },
    { path: phaseRealLeather2VariantPath('A'), label: 'REALLEATHER2-A' },
    { path: phaseRealLeather2VariantPath('B'), label: 'REALLEATHER2-B' },
  ]);

  const body = {
    phase: 'RealLeather2',
    purpose: 'Smooth catalog-leather follow-up from RealLeather-B: more sheen, form depth, and satin finish',
    notFinalBaliSilk: true,
    base: 'RealLeather-B on top of Phase 6A',
    referenceImage: REALISM_REFERENCE_PATH,
    forbidden: [
      'detail/detail2/detail3 transfer path',
      'visible swatch texture',
      'mottle fields',
      'stamped UV detail',
      'cloudy patches',
      'plastic shine',
    ],
    method: {
      swatch: 'Average Bali Silk a/b only',
      sheen: 'Broad source-highlight-following satin lift',
      formDepth: 'Signed source-form lift/pocket response along existing curvature and seams',
      grain: 'Almost invisible procedural micrograin only to avoid dead flatness',
      tint: 'Slight warm highlight tint only in lit zones',
    },
    swatchMeanLab: swatchMean,
    base6aMeanLab: baseMeanLab,
    outputs: {
      variants: [phaseRealLeather2VariantPath('A'), phaseRealLeather2VariantPath('B')],
      compareGrid: PHASE_REALLEATHER2_COMPARE_GRID,
      spec: PHASE_REALLEATHER2_SPEC,
    },
    variants: results,
  };

  writeFileSync(PHASE_REALLEATHER2_SPEC, JSON.stringify(body, null, 2));
  return { compareGrid: PHASE_REALLEATHER2_COMPARE_GRID, spec: PHASE_REALLEATHER2_SPEC, results };
}
