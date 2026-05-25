import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, erode, intersect, subtract, union } from '../phase1/masks.js';
import { BALI_SILK_SWATCH, DEBUG_DIR, REPO_ROOT } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { boxBlur, buildLinearL, clamp, labToRgb, meanUpholsteryLab, rgbToLab } from '../phase5/labUtil.js';
import { loadImageRGBA } from '../recolor/imageIO.js';
import { cropSwatchCenter } from '../phase9/swatchMaps.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';

const REALISM_REFERENCE_PATH = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'Bali-Silk-realism-reference.png');
const DETAIL3_A_PATH = join(DEBUG_DIR, 'phaseDetail3-variant-A.png');
const REALLEATHER2_B_PATH = join(DEBUG_DIR, 'phaseRealLeather2-variant-B.png');

export const PHASE_REALLEATHER3_COMPARE_GRID = join(DEBUG_DIR, 'phaseRealLeather3-compare-grid.png');
export const PHASE_REALLEATHER3_SPEC = join(DEBUG_DIR, 'phaseRealLeather3-spec.json');

export function phaseRealLeather3VariantPath(id: string) {
  return join(DEBUG_DIR, `phaseRealLeather3-variant-${id}.png`);
}

interface VariantParams {
  id: 'A' | 'B';
  label: string;
  micrograinStrength: number;
  sheenStrength: number;
  formContrastStrength: number;
  shadowPocketStrength: number;
  cushionGradientStrength: number;
  warmHighlightTint: number;
  chromaBlend: number;
}

const VARIANTS: VariantParams[] = [
  {
    id: 'A',
    label: 'REALLEATHER3-A',
    micrograinStrength: 0.35,
    sheenStrength: 7.0,
    formContrastStrength: 2.0,
    shadowPocketStrength: 0.45,
    cushionGradientStrength: 0.35,
    warmHighlightTint: 0.42,
    chromaBlend: 0.13,
  },
  {
    id: 'B',
    label: 'REALLEATHER3-B',
    micrograinStrength: 0.42,
    sheenStrength: 8.5,
    formContrastStrength: 2.35,
    shadowPocketStrength: 0.58,
    cushionGradientStrength: 0.48,
    warmHighlightTint: 0.48,
    chromaBlend: 0.14,
  },
];

interface FinishWeights {
  micrograin: Float32Array;
  specular: Float32Array;
  formContrast: Float32Array;
  shadowPocket: Float32Array;
  cushionGradient: Float32Array;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian1d(x: number, center: number, sigma: number): number {
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

function hash2d(x: number, y: number, seed: number): number {
  let h =
    Math.imul((x | 0) ^ (seed * 1597334677), 2246822519) ^
    Math.imul((y | 0) ^ (seed * 3266489917), 668265263);
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
      const n1 = valueNoise(x + 5.2, y - 3.4, 1.8, 19);
      const n2 = valueNoise(x * 1.02, y * 0.98, 2.4, 31);
      const n3 = valueNoise(x - 12.7, y + 9.1, 1.2, 47);
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
  if (!bb) {
    return {
      data: new Uint8Array(upholstery.width * upholstery.height),
      width: upholstery.width,
      height: upholstery.height,
    };
  }
  const bottom = {
    data: new Uint8Array(upholstery.width * upholstery.height),
    width: upholstery.width,
    height: upholstery.height,
  };
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
  const specular = new Float32Array(n);
  const formContrast = new Float32Array(n);
  const shadowPocket = new Float32Array(n);
  const cushionGradient = new Float32Array(n);
  if (!bb) return { micrograin, specular, formContrast, shadowPocket, cushionGradient };

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);
  const gates = buildSourceStructureGates(source, upholstery);

  const edgeMask = subtract(upholstery, erode(upholstery, 4));
  const edgeField = new Float32Array(n);
  for (let j = 0; j < n; j++) edgeField[j] = edgeMask.data[j] >= 128 ? 1 : 0;
  const edgeBlur = boxBlur(edgeField, width, height, 5);
  const seamWide = boxBlur(gates.seamEdge, width, height, 10);
  const highlightWide = boxBlur(gates.highlight, width, height, 16);

  const baseL = buildLinearL(base6a);
  const blurNear = boxBlur(baseL, width, height, 6);
  const blurFar = boxBlur(baseL, width, height, 24);

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128 || bottomGuard.data[j] >= 128) continue;

      const p = j * channels;
      const lab = rgbToLab(base6a.data[p], base6a.data[p + 1], base6a.data[p + 2]);
      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;

      const inBack = yNorm < 0.5 && xNorm > 0.14 && xNorm < 0.86;
      const inArm = yNorm >= 0.14 && yNorm < 0.72 && (xNorm < 0.3 || xNorm > 0.7);
      const inSeat = yNorm >= 0.3 && yNorm < 0.62;
      const inRail = yNorm >= 0.5 && yNorm < 0.76 && xNorm > 0.1 && xNorm < 0.9;
      const openField = inBack || inArm || inSeat || inRail ? 1 : 0;

      const signedForm = clamp((blurNear[j] - blurFar[j]) / 6.5, -1, 1);
      const lift = clamp(signedForm, 0, 1);
      const pocket = clamp(-signedForm, 0, 1);

      const midtone = smoothstep(56, 64, lab.L) * (1 - smoothstep(82, 90, lab.L));
      const edgeSuppress = 1 - edgeBlur[j] * 0.97;
      const seamSuppress = 1 - seamWide[j] * 0.93;
      const highlightSuppress = 1 - gates.highlight[j] * 0.95;

      micrograin[j] = openField * midtone * seamSuppress * highlightSuppress * edgeSuppress;

      const backCenters =
        gaussian1d(xNorm, 0.2, 0.09) + gaussian1d(xNorm, 0.5, 0.09) + gaussian1d(xNorm, 0.8, 0.09);
      const backTopBand = smoothstep(0.08, 0.18, yNorm) * (1 - smoothstep(0.34, 0.48, yNorm));
      const backHighlights = inBack ? backCenters * backTopBand : 0;

      const seatTopFront = inSeat ? gaussian1d(yNorm, 0.46, 0.07) : 0;
      const armRoll = inArm ? gaussian1d(yNorm, 0.42, 0.12) : 0;
      const railUpper = inRail ? gaussian1d(yNorm, 0.58, 0.045) : 0;

      specular[j] =
        openField *
        edgeSuppress *
        (0.2 + 0.8 * lift) *
        (0.3 + 0.7 * highlightWide[j]) *
        (0.55 * backHighlights + 0.35 * seatTopFront + 0.5 * armRoll + 0.3 * railUpper + 0.2 * highlightWide[j]);

      const verticalBackGaps =
        (gaussian1d(xNorm, 0.34, 0.03) + gaussian1d(xNorm, 0.66, 0.03)) *
        (1 - smoothstep(0.46, 0.56, yNorm)) *
        smoothstep(0.1, 0.18, yNorm);
      const underBackSeam = gaussian1d(yNorm, 0.52, 0.035) * smoothstep(0.12, 0.9, xNorm) * (1 - smoothstep(0.9, 0.98, xNorm));
      const horizontalBreak = gaussian1d(yNorm, 0.66, 0.03);
      const lowerRailShadow = inRail ? gaussian1d(yNorm, 0.76, 0.035) : 0;
      const insideArmCurves = inArm ? gaussian1d(yNorm, 0.52, 0.12) * (xNorm < 0.3 ? gaussian1d(xNorm, 0.2, 0.05) : gaussian1d(xNorm, 0.8, 0.05)) : 0;

      shadowPocket[j] =
        edgeSuppress *
        (0.65 * verticalBackGaps +
          0.65 * underBackSeam +
          0.6 * horizontalBreak +
          0.5 * lowerRailShadow +
          0.55 * insideArmCurves +
          0.25 * seamWide[j] +
          0.25 * pocket);

      const backCenterLift = inBack ? backCenters * backTopBand : 0;
      cushionGradient[j] = edgeSuppress * (backCenterLift * (1 - seamWide[j] * 0.4));

      formContrast[j] =
        openField *
        edgeSuppress *
        (0.45 + 0.55 * seamWide[j]) *
        (0.7 * Math.abs(signedForm) + 0.3 * lift) *
        (1 - gates.highlight[j] * 0.35);
    }
  }

  const specularBlur = boxBlur(specular, width, height, 6);
  const shadowBlur = boxBlur(shadowPocket, width, height, 4);
  const gradientBlur = boxBlur(cushionGradient, width, height, 8);
  for (let i = 0; i < n; i++) {
    specular[i] = clamp(specularBlur[i], 0, 1);
    shadowPocket[i] = clamp(shadowBlur[i], 0, 1);
    cushionGradient[i] = clamp(gradientBlur[i], 0, 1);
  }

  return { micrograin, specular, formContrast, shadowPocket, cushionGradient };
}

function applyRealLeather3(
  realLeather2B: RgbaImage,
  base6a: RgbaImage,
  upholstery: Mask,
  weights: FinishWeights,
  micrograinField: Float32Array,
  swatchMean: { meanA: number; meanB: number },
  baseMeanLab: { meanA: number; meanB: number },
  params: VariantParams,
): RgbaImage {
  const out = Buffer.from(realLeather2B.data);
  const { width, height, channels } = realLeather2B;
  const deltaA = swatchMean.meanA - baseMeanLab.meanA;
  const deltaB = swatchMean.meanB - baseMeanLab.meanB;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(realLeather2B.data[p], realLeather2B.data[p + 1], realLeather2B.data[p + 2]);

    const grainDelta =
      Math.tanh(micrograinField[j] * 1.15) *
      0.42 *
      params.micrograinStrength *
      weights.micrograin[j];

    const highlightTone = 0.2 + 0.8 * clamp((lab.L - 56) / 24, 0, 1);
    const sheenDelta =
      params.sheenStrength *
      0.2 *
      weights.specular[j] *
      highlightTone;

    const formDelta =
      params.formContrastStrength * 0.32 * weights.formContrast[j] +
      params.cushionGradientStrength * 0.75 * weights.cushionGradient[j] -
      params.shadowPocketStrength * 0.92 * weights.shadowPocket[j];

    let L = lab.L + grainDelta + sheenDelta + formDelta;
    const delta = L - lab.L;
    const pos = Math.max(0, delta);
    const neg = Math.max(0, -delta);
    const curved = pos * 0.9 - neg * 1.05;
    L = lab.L + clamp(curved, -3.3, 4.0);

    const warmMask = clamp(weights.specular[j] * highlightTone, 0, 1);
    const a = lab.a + params.chromaBlend * deltaA - params.warmHighlightTint * 0.07 * warmMask;
    const b = lab.b + params.chromaBlend * deltaB + params.warmHighlightTint * 0.24 * warmMask;

    const rgb = labToRgb(L, a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = realLeather2B.data[p + 3];
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

export async function runPhaseRealLeather3() {
  const { source, image: base6a, upholstery, lower12 } = await buildPhase6aBase();
  const realLeather2B = await loadImageRGBA(REALLEATHER2_B_PATH);
  const detail3A = await loadImageRGBA(DETAIL3_A_PATH);
  const swatch = await loadImageRGBA(BALI_SILK_SWATCH);
  const swatchMean = computeSwatchMeanLab(swatch);
  const baseMeanLab = meanUpholsteryLab(base6a, upholstery);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const weights = buildFinishWeights(base6a, source, upholstery, bottomGuard);
  const micrograin = buildMicrograinField(base6a.width, base6a.height);

  const base6aTmp = join(DEBUG_DIR, '_phaseRealLeather3-base6a.png');
  await writeRgbaPng(base6aTmp, base6a);

  const results: {
    id: string;
    label: string;
    path: string;
    params: Omit<VariantParams, 'id' | 'label'>;
    vs6a: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsDetail3A: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsRealLeather2B: ReturnType<typeof compareUpholsteryImages>['stats'];
    meanLab: { meanL: number; meanA: number; meanB: number; count: number };
  }[] = [];

  for (const variant of VARIANTS) {
    const image = applyRealLeather3(realLeather2B, base6a, upholstery, weights, micrograin, swatchMean, baseMeanLab, variant);
    const path = phaseRealLeather3VariantPath(variant.id);
    await writeRgbaPng(path, image);

    results.push({
      id: variant.id,
      label: variant.label,
      path,
      params: {
        micrograinStrength: variant.micrograinStrength,
        sheenStrength: variant.sheenStrength,
        formContrastStrength: variant.formContrastStrength,
        shadowPocketStrength: variant.shadowPocketStrength,
        cushionGradientStrength: variant.cushionGradientStrength,
        warmHighlightTint: variant.warmHighlightTint,
        chromaBlend: variant.chromaBlend,
      },
      vs6a: compareUpholsteryImages(base6a, image, upholstery).stats,
      vsDetail3A: compareUpholsteryImages(detail3A, image, upholstery).stats,
      vsRealLeather2B: compareUpholsteryImages(realLeather2B, image, upholstery).stats,
      meanLab: meanUpholsteryLab(image, upholstery),
    });
  }

  await writeCompareGrid(PHASE_REALLEATHER3_COMPARE_GRID, [
    { path: base6aTmp, label: '6A' },
    { path: DETAIL3_A_PATH, label: 'DETAIL3-A' },
    { path: REALLEATHER2_B_PATH, label: 'REALLEATHER2-B' },
    { path: phaseRealLeather3VariantPath('A'), label: 'REALLEATHER3-A' },
    { path: phaseRealLeather3VariantPath('B'), label: 'REALLEATHER3-B' },
  ]);

  const body = {
    phase: 'RealLeather3',
    purpose: 'Stronger smooth catalog leather from RealLeather2-B via light response, not texture',
    notFinalBaliSilk: true,
    base: 'RealLeather2-B',
    referenceImage: REALISM_REFERENCE_PATH,
    forbidden: [
      'detail/detail2/detail3 transfer path',
      'swatch texture transfer',
      'mottle',
      'visible grain pattern',
      'cloudy patches',
      'dirty bands',
      'plastic shine',
    ],
    method: {
      swatch: 'Average Bali Silk a/b only',
      specular: 'Broad smooth highlight shaping from source highlight geography + cushion bands',
      shadowPockets: 'Existing seam/gap/arm/rail pockets only',
      cushionGradient: 'Smooth center lift on back cushions with seam-edge depth retained',
      grain: 'Barely visible procedural micrograin only to avoid dead flatness',
      finishCurve: 'Lift highlights gently, hold mids, slightly deepen shadows, clamp extremes',
    },
    swatchMeanLab: swatchMean,
    base6aMeanLab: baseMeanLab,
    outputs: {
      variants: [phaseRealLeather3VariantPath('A'), phaseRealLeather3VariantPath('B')],
      compareGrid: PHASE_REALLEATHER3_COMPARE_GRID,
      spec: PHASE_REALLEATHER3_SPEC,
    },
    variants: results,
  };

  writeFileSync(PHASE_REALLEATHER3_SPEC, JSON.stringify(body, null, 2));
  return { compareGrid: PHASE_REALLEATHER3_COMPARE_GRID, spec: PHASE_REALLEATHER3_SPEC, results };
}
