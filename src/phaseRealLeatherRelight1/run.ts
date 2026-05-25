import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, erode, subtract } from '../phase1/masks.js';
import { DEBUG_DIR, REALLEATHER_LOCKED_IMAGE, REPO_ROOT, SOURCE_OUT } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { boxBlur, clamp, labToRgb, meanUpholsteryLab, rgbToLab } from '../phase5/labUtil.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';
import { loadImageRGBA } from '../recolor/imageIO.js';

const REALISM_REFERENCE_PATH = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'Bali-Silk-realism-reference.png');

export const PHASE_REALLEATHER_RELIGHT1_COMPARE_GRID = join(DEBUG_DIR, 'phaseRealLeatherRelight1-compare-grid.png');
export const PHASE_REALLEATHER_RELIGHT1_SPEC = join(DEBUG_DIR, 'phaseRealLeatherRelight1-spec.json');

export function phaseRealLeatherRelight1VariantPath(id: string) {
  return join(DEBUG_DIR, `phaseRealLeatherRelight1-variant-${id}.png`);
}

interface VariantParams {
  id: 'A' | 'B';
  label: string;
  curveStrength: number;
  refGuideStrength: number;
  backCenterLift: number;
  seatTopLift: number;
  armHighlightLift: number;
  satinLift: number;
  seamDepth: number;
  underBackDepth: number;
  armPocketDepth: number;
  railDepth: number;
  lowerShadowDepth: number;
  topKnee: number;
  topCompress: number;
  deltaClamp: number;
}

const VARIANTS: VariantParams[] = [
  {
    id: 'A',
    label: 'RELIGHT-A',
    curveStrength: 0.9,
    refGuideStrength: 1.0,
    backCenterLift: 2.8,
    seatTopLift: 1.35,
    armHighlightLift: 1.45,
    satinLift: 1.05,
    seamDepth: 1.8,
    underBackDepth: 1.45,
    armPocketDepth: 1.05,
    railDepth: 1.55,
    lowerShadowDepth: 1.08,
    topKnee: 81.8,
    topCompress: 0.68,
    deltaClamp: 6.4,
  },
  {
    id: 'B',
    label: 'RELIGHT-B',
    curveStrength: 1.08,
    refGuideStrength: 1.35,
    backCenterLift: 4.0,
    seatTopLift: 1.8,
    armHighlightLift: 2.0,
    satinLift: 1.45,
    seamDepth: 2.35,
    underBackDepth: 1.9,
    armPocketDepth: 1.45,
    railDepth: 2.1,
    lowerShadowDepth: 1.55,
    topKnee: 80.7,
    topCompress: 0.58,
    deltaClamp: 7.8,
  },
];

export interface HandMasks {
  backCenter: Float32Array;
  backEdgeSeam: Float32Array;
  seatTop: Float32Array;
  underBackSeam: Float32Array;
  frontRailUpper: Float32Array;
  frontRailLower: Float32Array;
  armHighlight: Float32Array;
  armPocket: Float32Array;
  lowerShadow: Float32Array;
  seamKeep: Float32Array;
  openField: Float32Array;
  edgeBand: Float32Array;
  highlightGuide: Float32Array;
  shadowGuide: Float32Array;
}

export interface ToneAnalysis {
  basePercentiles: number[];
  refPercentiles: number[];
  highlightThreshold: number;
  shadowThreshold: number;
}

export interface DiagnosticStats {
  label: string;
  contrastRange: number;
  shadowDepth: number;
  highlightPlacement: {
    upperBackShare: number;
    seatTopShare: number;
    armShare: number;
  };
  cushionCenterToEdgeGradient: number;
  seamDarkness: number;
  armCurvatureShading: number;
  frontRailDepth: number;
  backgroundEdgeIntegration: number;
  perceivedMaterialRealism: number;
  notes: string[];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian1d(x: number, center: number, sigma: number): number {
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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

export function buildLField(image: RgbaImage): Float32Array {
  const n = image.width * image.height;
  const field = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * image.channels;
    field[j] = rgbToLab(image.data[p], image.data[p + 1], image.data[p + 2]).L;
  }
  return field;
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

function weightedMean(field: Float32Array, weights: Float32Array, minWeight = 0.001): number {
  let sum = 0;
  let total = 0;
  for (let j = 0; j < field.length; j++) {
    const w = weights[j];
    if (w <= minWeight) continue;
    sum += field[j] * w;
    total += w;
  }
  return total > 0 ? sum / total : 0;
}

export function analyzeTone(base: RgbaImage, reference: RgbaImage, upholstery: Mask): ToneAnalysis {
  const baseL = buildLField(base);
  const refL = buildLField(reference);
  const basePercentiles = [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => percentileMasked(baseL, upholstery, p));
  const refPercentiles = [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => percentileMasked(refL, upholstery, p));
  return {
    basePercentiles,
    refPercentiles,
    highlightThreshold: refPercentiles[3],
    shadowThreshold: refPercentiles[1],
  };
}

export function mapLThroughCurve(L: number, baseP: number[], refP: number[]): number {
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

export function buildHandMasks(source: RgbaImage, reference: RgbaImage, upholstery: Mask): HandMasks {
  const { width, height } = source;
  const n = width * height;
  const backCenter = new Float32Array(n);
  const backEdgeSeam = new Float32Array(n);
  const seatTop = new Float32Array(n);
  const underBackSeam = new Float32Array(n);
  const frontRailUpper = new Float32Array(n);
  const frontRailLower = new Float32Array(n);
  const armHighlight = new Float32Array(n);
  const armPocket = new Float32Array(n);
  const lowerShadow = new Float32Array(n);
  const seamKeep = new Float32Array(n);
  const openField = new Float32Array(n);
  const edgeBand = new Float32Array(n);
  const highlightGuide = new Float32Array(n);
  const shadowGuide = new Float32Array(n);
  const bb = bbox(upholstery);
  if (!bb) {
    return {
      backCenter,
      backEdgeSeam,
      seatTop,
      underBackSeam,
      frontRailUpper,
      frontRailLower,
      armHighlight,
      armPocket,
      lowerShadow,
      seamKeep,
      openField,
      edgeBand,
      highlightGuide,
      shadowGuide,
    };
  }

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);
  const gates = buildSourceStructureGates(source, upholstery);
  const seamWide = boxBlur(gates.seamEdge, width, height, 10);
  const highlightWide = boxBlur(gates.highlight, width, height, 14);
  const insideEdge = subtract(upholstery, erode(upholstery, 3));
  const edgeField = new Float32Array(n);
  for (let j = 0; j < n; j++) edgeField[j] = insideEdge.data[j] >= 128 ? 1 : 0;
  const edgeBlur = boxBlur(edgeField, width, height, 5);

  const refL = buildLField(reference);
  const refP75 = percentileMasked(refL, upholstery, 0.75);
  const refP95 = percentileMasked(refL, upholstery, 0.95);
  const refP25 = percentileMasked(refL, upholstery, 0.25);
  const refP50 = percentileMasked(refL, upholstery, 0.5);

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;

      const inBack = yNorm < 0.5 && xNorm > 0.12 && xNorm < 0.88;
      const inSeat = yNorm >= 0.32 && yNorm < 0.63;
      const inRail = yNorm >= 0.54 && yNorm < 0.79 && xNorm > 0.1 && xNorm < 0.9;
      const inArm = yNorm >= 0.14 && yNorm < 0.76 && (xNorm < 0.29 || xNorm > 0.71);
      const open = inBack || inSeat || inRail || inArm ? 1 : 0;

      const edgeSuppress = 1 - edgeBlur[j] * 0.96;
      const seamSuppress = 1 - seamWide[j] * 0.92;
      openField[j] = open * edgeSuppress;
      edgeBand[j] = clamp(edgeBlur[j], 0, 1);

      const backCenters =
        gaussian1d(xNorm, 0.2, 0.095) + gaussian1d(xNorm, 0.5, 0.095) + gaussian1d(xNorm, 0.8, 0.095);
      const backBand = smoothstep(0.08, 0.18, yNorm) * (1 - smoothstep(0.34, 0.48, yNorm));
      backCenter[j] = clamp(backCenters * backBand * edgeSuppress * seamSuppress, 0, 1);

      const verticalBackGaps =
        (gaussian1d(xNorm, 0.34, 0.026) + gaussian1d(xNorm, 0.66, 0.026)) *
        (1 - smoothstep(0.46, 0.56, yNorm)) *
        smoothstep(0.09, 0.18, yNorm);
      const outerBackEdges =
        (gaussian1d(xNorm, 0.12, 0.03) + gaussian1d(xNorm, 0.88, 0.03)) *
        smoothstep(0.12, 0.22, yNorm) *
        (1 - smoothstep(0.44, 0.54, yNorm));
      backEdgeSeam[j] = clamp((verticalBackGaps * 0.95 + outerBackEdges * 0.35 + seamWide[j] * 0.15) * edgeSuppress, 0, 1);

      seatTop[j] =
        inSeat
          ? clamp(
              gaussian1d(yNorm, 0.46, 0.06) *
                smoothstep(0.1, 0.18, xNorm) *
                (1 - smoothstep(0.82, 0.9, xNorm)) *
                edgeSuppress *
                seamSuppress,
              0,
              1,
            )
          : 0;

      underBackSeam[j] =
        clamp(
          gaussian1d(yNorm, 0.525, 0.03) *
            smoothstep(0.12, 0.92, xNorm) *
            (1 - smoothstep(0.92, 0.98, xNorm)) *
            edgeSuppress,
          0,
          1,
        ) * (0.75 + 0.25 * seamWide[j]);

      frontRailUpper[j] =
        inRail
          ? clamp(
              gaussian1d(yNorm, 0.62, 0.05) *
                smoothstep(0.12, 0.9, xNorm) *
                (1 - smoothstep(0.9, 0.98, xNorm)) *
                edgeSuppress,
              0,
              1,
            )
          : 0;

      frontRailLower[j] =
        inRail
          ? clamp(
              gaussian1d(yNorm, 0.76, 0.04) *
                smoothstep(0.12, 0.9, xNorm) *
                (1 - smoothstep(0.9, 0.98, xNorm)) *
                edgeSuppress,
              0,
              1,
            )
          : 0;

      armHighlight[j] =
        inArm
          ? clamp(
              gaussian1d(yNorm, 0.41, 0.12) *
                (xNorm < 0.29 ? gaussian1d(xNorm, 0.18, 0.06) : gaussian1d(xNorm, 0.82, 0.06)) *
                edgeSuppress *
                seamSuppress,
              0,
              1,
            )
          : 0;

      armPocket[j] =
        inArm
          ? clamp(
              gaussian1d(yNorm, 0.57, 0.13) *
                (xNorm < 0.29 ? gaussian1d(xNorm, 0.22, 0.045) : gaussian1d(xNorm, 0.78, 0.045)) *
                edgeSuppress,
              0,
              1,
            )
          : 0;

      lowerShadow[j] = clamp(frontRailLower[j] * 0.7 + underBackSeam[j] * 0.25 + armPocket[j] * 0.2, 0, 1);
      seamKeep[j] = clamp(backEdgeSeam[j] * 0.6 + underBackSeam[j] * 0.7 + seamWide[j] * 0.32, 0, 1);

      highlightGuide[j] = clamp((refL[j] - refP75) / Math.max(refP95 - refP75, 1e-6), 0, 1);
      shadowGuide[j] = clamp((refP50 - refL[j]) / Math.max(refP50 - refP25, 1e-6), 0, 1);
    }
  }

  const blurRadius = {
    center: 10,
    seam: 5,
    seat: 8,
    rail: 6,
    arm: 7,
    guide: 12,
  };

  const centerBlur = boxBlur(backCenter, width, height, blurRadius.center);
  const edgeSeamBlur = boxBlur(backEdgeSeam, width, height, blurRadius.seam);
  const seatBlur = boxBlur(seatTop, width, height, blurRadius.seat);
  const underBlur = boxBlur(underBackSeam, width, height, blurRadius.seam);
  const railUpperBlur = boxBlur(frontRailUpper, width, height, blurRadius.rail);
  const railLowerBlur = boxBlur(frontRailLower, width, height, blurRadius.rail);
  const armHighlightBlur = boxBlur(armHighlight, width, height, blurRadius.arm);
  const armPocketBlur = boxBlur(armPocket, width, height, blurRadius.arm);
  const lowerShadowBlur = boxBlur(lowerShadow, width, height, blurRadius.rail);
  const seamKeepBlur = boxBlur(seamKeep, width, height, blurRadius.seam);
  const openBlur = boxBlur(openField, width, height, 6);
  const highlightGuideBlur = boxBlur(highlightGuide, width, height, blurRadius.guide);
  const shadowGuideBlur = boxBlur(shadowGuide, width, height, blurRadius.guide);

  for (let i = 0; i < n; i++) {
    backCenter[i] = clamp(centerBlur[i], 0, 1);
    backEdgeSeam[i] = clamp(edgeSeamBlur[i], 0, 1);
    seatTop[i] = clamp(seatBlur[i], 0, 1);
    underBackSeam[i] = clamp(underBlur[i], 0, 1);
    frontRailUpper[i] = clamp(railUpperBlur[i], 0, 1);
    frontRailLower[i] = clamp(railLowerBlur[i], 0, 1);
    armHighlight[i] = clamp(armHighlightBlur[i], 0, 1);
    armPocket[i] = clamp(armPocketBlur[i], 0, 1);
    lowerShadow[i] = clamp(lowerShadowBlur[i], 0, 1);
    seamKeep[i] = clamp(seamKeepBlur[i], 0, 1);
    openField[i] = clamp(openBlur[i], 0, 1);
    highlightGuide[i] = clamp(highlightGuideBlur[i], 0, 1);
    shadowGuide[i] = clamp(shadowGuideBlur[i], 0, 1);
  }

  return {
    backCenter,
    backEdgeSeam,
    seatTop,
    underBackSeam,
    frontRailUpper,
    frontRailLower,
    armHighlight,
    armPocket,
    lowerShadow,
    seamKeep,
    openField,
    edgeBand,
    highlightGuide,
    shadowGuide,
  };
}

export function buildBackgroundRing(upholstery: Mask): Mask {
  const dilated = dilate(upholstery, 8);
  return subtract(dilated, upholstery);
}

function buildRealismScore(analysis: Omit<DiagnosticStats, 'perceivedMaterialRealism' | 'notes'>, reference: Omit<DiagnosticStats, 'perceivedMaterialRealism' | 'notes'>): number {
  const diffs = [
    Math.abs(analysis.contrastRange - reference.contrastRange) / Math.max(reference.contrastRange, 1e-6),
    Math.abs(analysis.shadowDepth - reference.shadowDepth) / Math.max(reference.shadowDepth, 1e-6),
    Math.abs(analysis.cushionCenterToEdgeGradient - reference.cushionCenterToEdgeGradient) /
      Math.max(Math.abs(reference.cushionCenterToEdgeGradient), 1e-6),
    Math.abs(analysis.seamDarkness - reference.seamDarkness) / Math.max(Math.abs(reference.seamDarkness), 1e-6),
    Math.abs(analysis.armCurvatureShading - reference.armCurvatureShading) /
      Math.max(Math.abs(reference.armCurvatureShading), 1e-6),
    Math.abs(analysis.frontRailDepth - reference.frontRailDepth) / Math.max(Math.abs(reference.frontRailDepth), 1e-6),
    Math.abs(analysis.highlightPlacement.upperBackShare - reference.highlightPlacement.upperBackShare),
    Math.abs(analysis.highlightPlacement.armShare - reference.highlightPlacement.armShare),
  ];
  const meanDiff = diffs.reduce((a, b) => a + Math.min(b, 1.25), 0) / diffs.length;
  return Math.round(clamp(100 * (1 - meanDiff * 0.9), 0, 100) * 10) / 10;
}

function buildDiagnosticNotes(
  analysis: Omit<DiagnosticStats, 'perceivedMaterialRealism' | 'notes'>,
  reference: Omit<DiagnosticStats, 'perceivedMaterialRealism' | 'notes'>,
): string[] {
  const notes: string[] = [];
  if (analysis.contrastRange < reference.contrastRange * 0.88) notes.push('overall contrast range is flatter than the reference');
  if (analysis.shadowDepth < reference.shadowDepth * 0.86) notes.push('shadow pockets are shallower than the reference');
  if (analysis.cushionCenterToEdgeGradient < reference.cushionCenterToEdgeGradient * 0.82)
    notes.push('cushion center-to-edge gradients are too weak');
  if (analysis.seamDarkness < reference.seamDarkness * 0.84) notes.push('seam darkness and cushion separation are too light');
  if (analysis.armCurvatureShading < reference.armCurvatureShading * 0.84) notes.push('arm curvature shading is not deep enough');
  if (analysis.frontRailDepth < reference.frontRailDepth * 0.82) notes.push('front rail depth is too shallow');
  if (analysis.highlightPlacement.upperBackShare < reference.highlightPlacement.upperBackShare * 0.85)
    notes.push('upper back highlight placement is less pronounced than the reference');
  if (!notes.length) notes.push('closest to the reference across the measured relight cues');
  return notes;
}

export function analyzeImage(
  label: string,
  image: RgbaImage,
  upholstery: Mask,
  backgroundRing: Mask,
  masks: HandMasks,
  referenceDiagnostic?: Omit<DiagnosticStats, 'perceivedMaterialRealism' | 'notes'>,
): DiagnosticStats {
  const L = buildLField(image);
  const p05 = percentileMasked(L, upholstery, 0.05);
  const p50 = percentileMasked(L, upholstery, 0.5);
  const p75 = percentileMasked(L, upholstery, 0.75);
  const p95 = percentileMasked(L, upholstery, 0.95);

  const brightThreshold = p75;
  let upperBackBright = 0;
  let seatTopBright = 0;
  let armBright = 0;
  let totalBright = 0;
  for (let j = 0; j < L.length; j++) {
    if (L[j] < brightThreshold || upholstery.data[j] < 128) continue;
    const w = L[j] - brightThreshold + 0.001;
    upperBackBright += w * masks.backCenter[j];
    seatTopBright += w * masks.seatTop[j];
    armBright += w * masks.armHighlight[j];
    totalBright += w;
  }

  const edgeMean = weightedMean(L, masks.edgeBand);
  const bgWeights = new Float32Array(L.length);
  for (let j = 0; j < bgWeights.length; j++) bgWeights[j] = backgroundRing.data[j] >= 128 ? 1 : 0;
  const bgMean = weightedMean(L, bgWeights);

  const baseDiagnostic = {
    label,
    contrastRange: p95 - p05,
    shadowDepth: p50 - p05,
    highlightPlacement: {
      upperBackShare: totalBright > 0 ? upperBackBright / totalBright : 0,
      seatTopShare: totalBright > 0 ? seatTopBright / totalBright : 0,
      armShare: totalBright > 0 ? armBright / totalBright : 0,
    },
    cushionCenterToEdgeGradient: weightedMean(L, masks.backCenter) - weightedMean(L, masks.backEdgeSeam),
    seamDarkness: weightedMean(L, masks.openField) - weightedMean(L, masks.seamKeep),
    armCurvatureShading: weightedMean(L, masks.armHighlight) - weightedMean(L, masks.armPocket),
    frontRailDepth: weightedMean(L, masks.frontRailUpper) - weightedMean(L, masks.frontRailLower),
    backgroundEdgeIntegration: bgMean - edgeMean,
  };

  if (!referenceDiagnostic) {
    return {
      ...baseDiagnostic,
      perceivedMaterialRealism: 100,
      notes: ['reference target'],
    };
  }

  return {
    ...baseDiagnostic,
    perceivedMaterialRealism: buildRealismScore(baseDiagnostic, referenceDiagnostic),
    notes: buildDiagnosticNotes(baseDiagnostic, referenceDiagnostic),
  };
}

function applyRelightVariant(
  base: RgbaImage,
  upholstery: Mask,
  tone: ToneAnalysis,
  masks: HandMasks,
  params: VariantParams,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);

    const targetL = mapLThroughCurve(lab.L, tone.basePercentiles, tone.refPercentiles);
    const curveDelta = (targetL - lab.L) * params.curveStrength;
    const refGuide = (masks.highlightGuide[j] * 0.95 - masks.shadowGuide[j] * 1.15) * params.refGuideStrength * 1.7;

    const lift =
      params.backCenterLift * masks.backCenter[j] * (0.7 + 0.3 * masks.highlightGuide[j]) +
      params.seatTopLift * masks.seatTop[j] * (0.6 + 0.4 * masks.highlightGuide[j]) +
      params.armHighlightLift * masks.armHighlight[j] * (0.58 + 0.42 * masks.highlightGuide[j]) +
      params.satinLift *
        (0.65 * masks.backCenter[j] + 0.45 * masks.seatTop[j] + 0.75 * masks.armHighlight[j]) *
        masks.highlightGuide[j] *
        (0.2 + 0.8 * smoothstep(58, 78, lab.L));

    const darken =
      params.seamDepth * masks.backEdgeSeam[j] * (0.72 + 0.28 * masks.shadowGuide[j]) +
      params.underBackDepth * masks.underBackSeam[j] * (0.72 + 0.28 * masks.shadowGuide[j]) +
      params.armPocketDepth * masks.armPocket[j] * (0.7 + 0.3 * masks.shadowGuide[j]) +
      params.railDepth * masks.frontRailLower[j] * (0.76 + 0.24 * masks.shadowGuide[j]) +
      params.lowerShadowDepth * masks.lowerShadow[j] * (0.7 + 0.3 * masks.shadowGuide[j]);

    let L = lab.L + curveDelta + refGuide + lift - darken;
    const dL = L - lab.L;
    const shaped = Math.max(0, dL) * 0.96 - Math.max(0, -dL) * 1.04;
    L = lab.L + clamp(shaped, -params.deltaClamp, params.deltaClamp);

    const kneeMix = smoothstep(params.topKnee, params.topKnee + 5.5, L);
    const clampedTop = params.topKnee + (L - params.topKnee) * params.topCompress;
    L = mix(L, clampedTop, kneeMix);

    const rgb = labToRgb(clamp(L, 0, 100), lab.a, lab.b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = base.data[p + 3];
  }

  return { data: out, width, height, channels };
}

export async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

async function panelWithLabel(imagePath: string, label: string): Promise<Buffer> {
  const labelHeight = 44;
  const meta = await sharp(imagePath).metadata();
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  const img = await sharp(imagePath).png().toBuffer();
  const labelSvg = Buffer.from(
    `<svg width="${width}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#fff">${label}</text>
    </svg>`,
  );
  return sharp({
    create: { width, height: height + labelHeight, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: img, top: 0, left: 0 },
      { input: labelSvg, top: height, left: 0 },
    ])
    .png()
    .toBuffer();
}

export async function writeCompareGrid(outPath: string, panels: { path: string; label: string }[]) {
  const labeled = await Promise.all(panels.map((panel) => panelWithLabel(panel.path, panel.label)));
  const metas = await Promise.all(labeled.map((buf) => sharp(buf).metadata()));
  const cellW = Math.max(...metas.map((meta) => meta.width ?? 0));
  const cellH = Math.max(...metas.map((meta) => meta.height ?? 0));
  const resized = await Promise.all(
    labeled.map((buf) => sharp(buf).resize(cellW, cellH, { fit: 'contain', background: '#ffffff' }).png().toBuffer()),
  );
  await sharp({
    create: { width: cellW * panels.length, height: cellH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(resized.map((input, i) => ({ input, left: i * cellW, top: 0 })))
    .png()
    .toFile(outPath);
}

export async function runPhaseRealLeatherRelight1() {
  const { source, image: base6a, upholstery } = await buildPhase6aBase();
  const sourceImage = await loadImageRGBA(SOURCE_OUT);
  const lockedBaseline = await loadImageRGBA(REALLEATHER_LOCKED_IMAGE);
  const reference = await loadResizedImageRGBA(REALISM_REFERENCE_PATH, base6a.width, base6a.height);
  const tone = analyzeTone(lockedBaseline, reference, upholstery);
  const masks = buildHandMasks(source, reference, upholstery);
  const backgroundRing = buildBackgroundRing(upholstery);

  const relightA = applyRelightVariant(lockedBaseline, upholstery, tone, masks, VARIANTS[0]);
  const relightB = applyRelightVariant(lockedBaseline, upholstery, tone, masks, VARIANTS[1]);

  const relightAPath = phaseRealLeatherRelight1VariantPath('A');
  const relightBPath = phaseRealLeatherRelight1VariantPath('B');
  await writeRgbaPng(relightAPath, relightA);
  await writeRgbaPng(relightBPath, relightB);

  const referenceDiagnosticBase = analyzeImage('Generated reference', reference, upholstery, backgroundRing, masks);
  const referenceDiagnostic: Omit<DiagnosticStats, 'perceivedMaterialRealism' | 'notes'> = {
    label: referenceDiagnosticBase.label,
    contrastRange: referenceDiagnosticBase.contrastRange,
    shadowDepth: referenceDiagnosticBase.shadowDepth,
    highlightPlacement: referenceDiagnosticBase.highlightPlacement,
    cushionCenterToEdgeGradient: referenceDiagnosticBase.cushionCenterToEdgeGradient,
    seamDarkness: referenceDiagnosticBase.seamDarkness,
    armCurvatureShading: referenceDiagnosticBase.armCurvatureShading,
    frontRailDepth: referenceDiagnosticBase.frontRailDepth,
    backgroundEdgeIntegration: referenceDiagnosticBase.backgroundEdgeIntegration,
  };

  const diagnostics = {
    source: analyzeImage('Source sofa', sourceImage, upholstery, backgroundRing, masks, referenceDiagnostic),
    base6a: analyzeImage('6A base', base6a, upholstery, backgroundRing, masks, referenceDiagnostic),
    lockedBaseline: analyzeImage('Locked baseline', lockedBaseline, upholstery, backgroundRing, masks, referenceDiagnostic),
    reference: referenceDiagnosticBase,
    relightA: analyzeImage('RELIGHT-A', relightA, upholstery, backgroundRing, masks, referenceDiagnostic),
    relightB: analyzeImage('RELIGHT-B', relightB, upholstery, backgroundRing, masks, referenceDiagnostic),
  };

  const sourceTmp = join(DEBUG_DIR, '_phaseRealLeatherRelight1-source.png');
  const base6aTmp = join(DEBUG_DIR, '_phaseRealLeatherRelight1-base6a.png');
  const baselineTmp = join(DEBUG_DIR, '_phaseRealLeatherRelight1-baseline.png');
  const referenceTmp = join(DEBUG_DIR, '_phaseRealLeatherRelight1-reference.png');
  await writeRgbaPng(sourceTmp, sourceImage);
  await writeRgbaPng(base6aTmp, base6a);
  await writeRgbaPng(baselineTmp, lockedBaseline);
  await writeRgbaPng(referenceTmp, reference);

  await writeCompareGrid(PHASE_REALLEATHER_RELIGHT1_COMPARE_GRID, [
    { path: sourceTmp, label: 'SOURCE' },
    { path: base6aTmp, label: '6A' },
    { path: baselineTmp, label: 'LOCKED BASELINE' },
    { path: referenceTmp, label: 'GENERATED REFERENCE' },
    { path: relightAPath, label: 'RELIGHT-A' },
    { path: relightBPath, label: 'RELIGHT-B' },
  ]);

  const spec = {
    phase: 'RealLeather Relight 1',
    purpose: 'Stronger reference-guided relighting with explicit region masks, not a minor finish pass',
    checkpointOnlyBaseline: REALLEATHER_LOCKED_IMAGE,
    baseChoice: {
      chosenBase: 'Locked RealLeather checkpoint',
      reason: 'Preserves current Bali Silk color while allowing stronger relight deltas than 6A',
    },
    method: {
      target: 'Generated realistic reference',
      doNotUse: [
        'texture transfer',
        'Detail phases',
        'mottle',
        'visible grain',
        'stamped texture',
        'minor tone-only tweaks',
      ],
      handAuthoredMasks: [
        'back cushion centers',
        'back cushion edges and seams',
        'seat cushion tops',
        'horizontal seam under backs',
        'front rail',
        'arms',
        'lower shadows',
      ],
      relightActions: [
        'lift cushion centers more clearly',
        'deepen seams and cushion separations',
        'deepen lower rail and under-seat shadows',
        'add broad satin highlights on cushion tops and arms',
        'compress high-end highlights to stay smooth',
      ],
    },
    diagnostics,
    outputs: {
      compareGrid: PHASE_REALLEATHER_RELIGHT1_COMPARE_GRID,
      variantA: relightAPath,
      variantB: relightBPath,
      spec: PHASE_REALLEATHER_RELIGHT1_SPEC,
    },
    variants: [
      {
        ...VARIANTS[0],
        meanLab: meanUpholsteryLab(relightA, upholstery),
        vs6a: compareUpholsteryImages(base6a, relightA, upholstery).stats,
        vsLockedBaseline: compareUpholsteryImages(lockedBaseline, relightA, upholstery).stats,
      },
      {
        ...VARIANTS[1],
        meanLab: meanUpholsteryLab(relightB, upholstery),
        vs6a: compareUpholsteryImages(base6a, relightB, upholstery).stats,
        vsLockedBaseline: compareUpholsteryImages(lockedBaseline, relightB, upholstery).stats,
      },
    ],
  };

  writeFileSync(PHASE_REALLEATHER_RELIGHT1_SPEC, JSON.stringify(spec, null, 2));
  return { compareGrid: PHASE_REALLEATHER_RELIGHT1_COMPARE_GRID, spec: PHASE_REALLEATHER_RELIGHT1_SPEC, relightAPath, relightBPath };
}
