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
const REALLEATHER3_B_PATH = join(DEBUG_DIR, 'phaseRealLeather3-variant-B.png');
const REALLEATHER2_B_PATH = join(DEBUG_DIR, 'phaseRealLeather2-variant-B.png');

export const PHASE_REALLEATHER_REF_COMPARE_GRID = join(DEBUG_DIR, 'phaseRealLeatherReferenceMatch-compare-grid.png');
export const PHASE_REALLEATHER_REF_SPEC = join(DEBUG_DIR, 'phaseRealLeatherReferenceMatch-spec.json');

export function phaseRealLeatherRefVariantPath(id: string) {
  return join(DEBUG_DIR, `phaseRealLeatherReferenceMatch-variant-${id}.png`);
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
    label: 'REALLEATHER-REF-A',
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
    label: 'REALLEATHER-REF-B',
    micrograinStrength: 0.42,
    sheenStrength: 8.5,
    formContrastStrength: 2.35,
    shadowPocketStrength: 0.58,
    cushionGradientStrength: 0.48,
    warmHighlightTint: 0.48,
    chromaBlend: 0.14,
  },
];

interface ToneAnalysis {
  basePercentiles: number[];
  refPercentiles: number[];
  midtoneContrastRatio: number;
  shadowDepthRatio: number;
  seamContrastRatio: number;
  highlightWarmA: number;
  highlightWarmB: number;
}

interface FinishMaps {
  micrograin: Float32Array;
  highlightShape: Float32Array;
  shadowPocket: Float32Array;
  cushionGradient: Float32Array;
  formContrast: Float32Array;
  smoothDelta: Float32Array;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian1d(x: number, center: number, sigma: number): number {
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

function percentileMasked(field: Float32Array, mask: Mask, p: number): number {
  const vals: number[] = [];
  for (let j = 0; j < field.length; j++) if (mask.data[j] >= 128) vals.push(field[j]);
  if (!vals.length) return 0;
  vals.sort((a, b) => a - b);
  const idx = (vals.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return vals[lo];
  return vals[lo] + (vals[hi] - vals[lo]) * (idx - lo);
}

function meanLabForThreshold(image: RgbaImage, mask: Mask, LField: Float32Array, threshold: number) {
  let sumA = 0;
  let sumB = 0;
  let count = 0;
  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128 || LField[j] < threshold) continue;
    const p = j * image.channels;
    const lab = rgbToLab(image.data[p], image.data[p + 1], image.data[p + 2]);
    sumA += lab.a;
    sumB += lab.b;
    count++;
  }
  return { meanA: count ? sumA / count : 0, meanB: count ? sumB / count : 0, count };
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
      const n1 = valueNoise(x + 3.8, y - 4.2, 1.8, 19);
      const n2 = valueNoise(x * 1.02, y * 0.98, 2.4, 31);
      const n3 = valueNoise(x - 10.1, y + 7.7, 1.25, 47);
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

async function loadResizedImageRGBA(path: string, width: number, height: number): Promise<RgbaImage> {
  const { data, info } = await sharp(path)
    .resize(width, height)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
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

function analyzeReference(base6a: RgbaImage, reference: RgbaImage, upholstery: Mask, seamMask: Float32Array): ToneAnalysis {
  const baseL = buildLinearL(base6a);
  const refL = buildLinearL(reference);
  const basePercentiles = [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => percentileMasked(baseL, upholstery, p));
  const refPercentiles = [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => percentileMasked(refL, upholstery, p));
  const baseIqr = Math.max(basePercentiles[3] - basePercentiles[1], 1e-6);
  const refIqr = Math.max(refPercentiles[3] - refPercentiles[1], 1e-6);
  const baseShadow = basePercentiles[2] - basePercentiles[0];
  const refShadow = refPercentiles[2] - refPercentiles[0];

  let seamBase = 0;
  let seamRef = 0;
  let seamN = 0;
  let openBase = 0;
  let openRef = 0;
  let openN = 0;
  for (let j = 0; j < upholstery.data.length; j++) {
    if (upholstery.data[j] < 128) continue;
    if (seamMask[j] > 0.35) {
      seamBase += baseL[j];
      seamRef += refL[j];
      seamN++;
    } else {
      openBase += baseL[j];
      openRef += refL[j];
      openN++;
    }
  }
  const baseSeamContrast = seamN && openN ? openBase / openN - seamBase / seamN : 0;
  const refSeamContrast = seamN && openN ? openRef / openN - seamRef / seamN : 0;

  const refHighlightThreshold = refPercentiles[3];
  const refOverall = meanUpholsteryLab(reference, upholstery);
  const refHighlights = meanLabForThreshold(reference, upholstery, refL, refHighlightThreshold);

  return {
    basePercentiles,
    refPercentiles,
    midtoneContrastRatio: refIqr / baseIqr,
    shadowDepthRatio: refShadow / Math.max(baseShadow, 1e-6),
    seamContrastRatio: refSeamContrast / Math.max(baseSeamContrast, 1e-6),
    highlightWarmA: refHighlights.meanA - refOverall.meanA,
    highlightWarmB: refHighlights.meanB - refOverall.meanB,
  };
}

function buildReferenceToneMap(
  base6a: RgbaImage,
  source: RgbaImage,
  reference: RgbaImage,
  upholstery: Mask,
  bottomGuard: Mask,
): { analysis: ToneAnalysis; maps: FinishMaps } {
  const { width, height, channels } = base6a;
  const n = width * height;
  const bb = bbox(upholstery);
  const micrograin = new Float32Array(n);
  const highlightShape = new Float32Array(n);
  const shadowPocket = new Float32Array(n);
  const cushionGradient = new Float32Array(n);
  const formContrast = new Float32Array(n);
  if (!bb) {
    return {
      analysis: {
        basePercentiles: [0, 0, 0, 0, 0],
        refPercentiles: [0, 0, 0, 0, 0],
        midtoneContrastRatio: 1,
        shadowDepthRatio: 1,
        seamContrastRatio: 1,
        highlightWarmA: 0,
        highlightWarmB: 0,
      },
      maps: {
        micrograin,
        highlightShape,
        shadowPocket,
        cushionGradient,
        formContrast,
        smoothDelta: new Float32Array(n),
      },
    };
  }

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);
  const gates = buildSourceStructureGates(source, upholstery);
  const analysis = analyzeReference(base6a, reference, upholstery, gates.seamEdge);

  const edgeMask = subtract(upholstery, erode(upholstery, 4));
  const edgeField = new Float32Array(n);
  for (let j = 0; j < n; j++) edgeField[j] = edgeMask.data[j] >= 128 ? 1 : 0;
  const edgeBlur = boxBlur(edgeField, width, height, 5);
  const seamWide = boxBlur(gates.seamEdge, width, height, 10);
  const highlightWide = boxBlur(gates.highlight, width, height, 16);

  const baseL = buildLinearL(base6a);
  const refL = buildLinearL(reference);
  const baseLow = boxBlur(baseL, width, height, 20);
  const refLow = boxBlur(refL, width, height, 20);
  const smoothDelta = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    smoothDelta[j] = clamp((refLow[j] - baseLow[j]) / 8, -1, 1);
  }

  const blurNear = boxBlur(baseL, width, height, 6);
  const blurFar = boxBlur(baseL, width, height, 24);
  const refHighlightThreshold = analysis.refPercentiles[3];

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
      const seamSuppress = 1 - seamWide[j] * 0.94;
      const highlightSuppress = 1 - gates.highlight[j] * 0.96;

      micrograin[j] = openField * midtone * seamSuppress * highlightSuppress * edgeSuppress;

      const backCenters =
        gaussian1d(xNorm, 0.2, 0.095) + gaussian1d(xNorm, 0.5, 0.095) + gaussian1d(xNorm, 0.8, 0.095);
      const backTopBand = smoothstep(0.08, 0.18, yNorm) * (1 - smoothstep(0.34, 0.48, yNorm));
      const backHighlights = inBack ? backCenters * backTopBand : 0;
      const seatTopFront = inSeat ? gaussian1d(yNorm, 0.46, 0.07) : 0;
      const armRoll = inArm ? gaussian1d(yNorm, 0.42, 0.12) : 0;
      const railUpper = inRail ? gaussian1d(yNorm, 0.58, 0.045) : 0;

      const refBright = clamp((refL[j] - refHighlightThreshold) / Math.max(analysis.refPercentiles[4] - refHighlightThreshold, 1e-6), 0, 1);
      highlightShape[j] =
        openField *
        edgeSuppress *
        seamSuppress *
        (0.45 + 0.55 * highlightWide[j]) *
        (0.6 + 0.4 * lift) *
        (0.55 * backHighlights + 0.35 * seatTopFront + 0.5 * armRoll + 0.28 * railUpper + 0.22 * refBright);

      const verticalBackGaps =
        (gaussian1d(xNorm, 0.34, 0.03) + gaussian1d(xNorm, 0.66, 0.03)) *
        (1 - smoothstep(0.46, 0.56, yNorm)) *
        smoothstep(0.1, 0.18, yNorm);
      const underBackSeam =
        gaussian1d(yNorm, 0.52, 0.035) *
        smoothstep(0.12, 0.9, xNorm) *
        (1 - smoothstep(0.9, 0.98, xNorm));
      const horizontalBreak = gaussian1d(yNorm, 0.66, 0.03);
      const lowerRailShadow = inRail ? gaussian1d(yNorm, 0.76, 0.035) : 0;
      const insideArmCurves =
        inArm
          ? gaussian1d(yNorm, 0.52, 0.12) *
            (xNorm < 0.3 ? gaussian1d(xNorm, 0.2, 0.05) : gaussian1d(xNorm, 0.8, 0.05))
          : 0;

      shadowPocket[j] =
        edgeSuppress *
        (0.6 * verticalBackGaps +
          0.62 * underBackSeam +
          0.58 * horizontalBreak +
          0.5 * lowerRailShadow +
          0.52 * insideArmCurves +
          0.24 * seamWide[j] +
          0.3 * pocket +
          0.28 * clamp(-smoothDelta[j], 0, 1));

      const backCenterLift = inBack ? backCenters * backTopBand : 0;
      cushionGradient[j] =
        edgeSuppress * seamSuppress * (backCenterLift * (0.7 + 0.3 * clamp(smoothDelta[j], 0, 1)));

      formContrast[j] =
        openField *
        edgeSuppress *
        (0.48 + 0.52 * seamWide[j]) *
        (0.7 * Math.abs(signedForm) + 0.3 * lift) *
        (1 - gates.highlight[j] * 0.32) *
        (0.7 + 0.3 * analysis.midtoneContrastRatio);
    }
  }

  const highlightBlur = boxBlur(highlightShape, width, height, 7);
  const shadowBlur = boxBlur(shadowPocket, width, height, 4);
  const gradientBlur = boxBlur(cushionGradient, width, height, 9);
  const contrastBlur = boxBlur(formContrast, width, height, 4);
  for (let i = 0; i < n; i++) {
    highlightShape[i] = clamp(highlightBlur[i], 0, 1);
    shadowPocket[i] = clamp(shadowBlur[i], 0, 1);
    cushionGradient[i] = clamp(gradientBlur[i], 0, 1);
    formContrast[i] = clamp(contrastBlur[i], 0, 1);
  }

  return {
    analysis,
    maps: { micrograin, highlightShape, shadowPocket, cushionGradient, formContrast, smoothDelta },
  };
}

function mapLThroughCurve(L: number, baseP: number[], refP: number[]): number {
  if (L <= baseP[0]) return refP[0];
  if (L >= baseP[4]) return refP[4];
  for (let i = 0; i < baseP.length - 1; i++) {
    if (L >= baseP[i] && L <= baseP[i + 1]) {
      const t = (L - baseP[i]) / Math.max(baseP[i + 1] - baseP[i], 1e-6);
      return refP[i] + (refP[i + 1] - refP[i]) * t;
    }
  }
  return L;
}

function applyRealLeather3(
  realLeather2B: RgbaImage,
  upholstery: Mask,
  swatchMean: { meanA: number; meanB: number },
  baseMeanLab: { meanA: number; meanB: number },
  tone: ToneAnalysis,
  maps: FinishMaps,
  micrograinField: Float32Array,
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

    const targetL = mapLThroughCurve(lab.L, tone.basePercentiles, tone.refPercentiles);
    const curveDelta = (targetL - lab.L) * 0.55;
    const grainDelta =
      Math.tanh(micrograinField[j] * 1.1) *
      0.28 *
      params.micrograinStrength *
      maps.micrograin[j];
    const sheenDelta =
      params.sheenStrength *
      0.18 *
      maps.highlightShape[j] *
      (0.35 + 0.65 * clamp((lab.L - 56) / 24, 0, 1));
    const contrastDelta =
      params.formContrastStrength * 0.24 * maps.formContrast[j] * clamp(maps.smoothDelta[j], -1, 1);
    const pocketDelta = -params.shadowPocketStrength * 0.95 * maps.shadowPocket[j];
    const cushionDelta = params.cushionGradientStrength * 0.85 * maps.cushionGradient[j];

    let L = lab.L + curveDelta + grainDelta + sheenDelta + contrastDelta + pocketDelta + cushionDelta;
    const dL = L - lab.L;
    const shaped = Math.max(0, dL) * 0.92 - Math.max(0, -dL) * 1.04;
    L = lab.L + clamp(shaped, -4.1, 4.8);

    const warmMask = clamp(maps.highlightShape[j] * (0.2 + 0.8 * clamp((lab.L - 58) / 22, 0, 1)), 0, 1);
    const a = lab.a + params.chromaBlend * deltaA - params.warmHighlightTint * tone.highlightWarmA * 0.2 * warmMask;
    const b = lab.b + params.chromaBlend * deltaB + params.warmHighlightTint * Math.max(0, tone.highlightWarmB) * 0.22 * warmMask;

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

export async function runPhaseRealLeatherReferenceMatch() {
  const { source, image: base6a, upholstery, lower12 } = await buildPhase6aBase();
  const realLeather2B = await loadImageRGBA(REALLEATHER2_B_PATH);
  const detail3A = await loadImageRGBA(DETAIL3_A_PATH);
  const reference = await loadResizedImageRGBA(REALISM_REFERENCE_PATH, base6a.width, base6a.height);
  const swatch = await loadImageRGBA(BALI_SILK_SWATCH);
  const swatchMean = computeSwatchMeanLab(swatch);
  const baseMeanLab = meanUpholsteryLab(base6a, upholstery);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const { analysis, maps } = buildReferenceToneMap(base6a, source, reference, upholstery, bottomGuard);
  const micrograin = buildMicrograinField(base6a.width, base6a.height);

  const base6aTmp = join(DEBUG_DIR, '_phaseRealLeatherReferenceMatch-base6a.png');
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
    const image = applyRealLeather3(realLeather2B, upholstery, swatchMean, baseMeanLab, analysis, maps, micrograin, variant);
    const path = phaseRealLeatherRefVariantPath(variant.id);
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

  await writeCompareGrid(PHASE_REALLEATHER_REF_COMPARE_GRID, [
    { path: base6aTmp, label: '6A' },
    { path: REALLEATHER2_B_PATH, label: 'REALLEATHER2-B' },
    { path: REALLEATHER3_B_PATH, label: 'REALLEATHER3-B' },
    { path: REALISM_REFERENCE_PATH, label: 'GENERATED REFERENCE' },
    { path: phaseRealLeatherRefVariantPath('A'), label: 'REALLEATHER-REF-A' },
    { path: phaseRealLeatherRefVariantPath('B'), label: 'REALLEATHER-REF-B' },
  ]);

  const body = {
    phase: 'RealLeather Reference Match',
    purpose: 'Reference-match smooth leather: tonal/material behavior from generated reference, not texture',
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
    referenceAnalysis: analysis,
    method: {
      swatch: 'Average Bali Silk a/b only',
      toneCurve: 'Percentile-based upholstery L curve matched toward reference',
      specular: 'Broad hand-authored region shaping modulated by source/reference highlight geography',
      shadowPockets: 'Existing seam/gap/arm/rail pockets only',
      cushionGradient: 'Smooth back-cushion center lift with seam-edge depth retained',
      grain: 'Barely visible procedural micrograin only to avoid dead flatness',
    },
    swatchMeanLab: swatchMean,
    base6aMeanLab: baseMeanLab,
    outputs: {
      variants: [phaseRealLeatherRefVariantPath('A'), phaseRealLeatherRefVariantPath('B')],
      compareGrid: PHASE_REALLEATHER_REF_COMPARE_GRID,
      spec: PHASE_REALLEATHER_REF_SPEC,
    },
    variants: results,
  };

  writeFileSync(PHASE_REALLEATHER_REF_SPEC, JSON.stringify(body, null, 2));
  return { compareGrid: PHASE_REALLEATHER_REF_COMPARE_GRID, spec: PHASE_REALLEATHER_REF_SPEC, results };
}

export const runPhaseRealLeather3 = runPhaseRealLeatherReferenceMatch;
