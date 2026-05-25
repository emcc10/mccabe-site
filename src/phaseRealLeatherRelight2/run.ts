import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Mask } from '../phase1/masks.js';
import { bbox, erode, subtract } from '../phase1/masks.js';
import { DEBUG_DIR, REPO_ROOT, SOURCE_OUT } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { boxBlur, clamp, labToRgb, meanUpholsteryLab, rgbToLab } from '../phase5/labUtil.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';
import {
  analyzeImage,
  analyzeTone,
  buildBackgroundRing,
  buildHandMasks,
  buildLField,
  mapLThroughCurve,
  phaseRealLeatherRelight1VariantPath,
  writeCompareGrid,
  writeRgbaPng,
  type DiagnosticStats,
  type HandMasks,
} from '../phaseRealLeatherRelight1/run.js';
import { loadImageRGBA } from '../recolor/imageIO.js';
import sharp from 'sharp';

const REALISM_REFERENCE_PATH = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'Bali-Silk-realism-reference.png');

export const PHASE_REALLEATHER_RELIGHT2_COMPARE_GRID = join(DEBUG_DIR, 'phaseRealLeatherRelight2-compare-grid.png');
export const PHASE_REALLEATHER_RELIGHT2_SPEC = join(DEBUG_DIR, 'phaseRealLeatherRelight2-spec.json');

export function phaseRealLeatherRelight2VariantPath(id: string) {
  return join(DEBUG_DIR, `phaseRealLeatherRelight2-variant-${id}.png`);
}

interface VariantParams {
  id: 'A' | 'B';
  label: string;
  curveStrength: number;
  seamBorrowStrength: number;
  centerReduce: number;
  armFlatten: number;
  railLift: number;
  lowerSeatLift: number;
  lowerShadowNeutralize: number;
}

const VARIANTS: VariantParams[] = [
  {
    id: 'A',
    label: 'RELIGHT2-A',
    curveStrength: 0.18,
    seamBorrowStrength: 0.06,
    centerReduce: 0.62,
    armFlatten: 0.72,
    railLift: 0.9,
    lowerSeatLift: 0.55,
    lowerShadowNeutralize: 0.42,
  },
  {
    id: 'B',
    label: 'RELIGHT2-B',
    curveStrength: 0.2,
    seamBorrowStrength: 0.14,
    centerReduce: 0.54,
    armFlatten: 0.72,
    railLift: 0.82,
    lowerSeatLift: 0.5,
    lowerShadowNeutralize: 0.38,
  },
];

interface CorrectionMasks {
  seamBorrow: Float32Array;
  armFlatten: Float32Array;
  backCenterReduce: Float32Array;
  railLift: Float32Array;
  lowerSeatLift: Float32Array;
  openNoArms: Float32Array;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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

function buildCorrectionMasks(source: RgbaImage, reference: RgbaImage, upholstery: Mask, masks: HandMasks): CorrectionMasks {
  const { width, height } = source;
  const n = width * height;
  const seamBorrow = new Float32Array(n);
  const armFlatten = new Float32Array(n);
  const backCenterReduce = new Float32Array(n);
  const railLift = new Float32Array(n);
  const lowerSeatLift = new Float32Array(n);
  const openNoArms = new Float32Array(n);
  const bb = bbox(upholstery);
  if (!bb) return { seamBorrow, armFlatten, backCenterReduce, railLift, lowerSeatLift, openNoArms };

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);
  const gates = buildSourceStructureGates(source, upholstery);
  const seamWide = boxBlur(gates.seamEdge, width, height, 10);
  const edgeMask = subtract(upholstery, erode(upholstery, 3));
  const edgeField = new Float32Array(n);
  for (let j = 0; j < n; j++) edgeField[j] = edgeMask.data[j] >= 128 ? 1 : 0;
  const edgeBlur = boxBlur(edgeField, width, height, 5);
  const refL = buildLField(reference);

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;
      const inSeat = yNorm >= 0.32 && yNorm < 0.63;
      const lowerSeatBand =
        inSeat &&
        yNorm > 0.47 &&
        xNorm > 0.12 &&
        xNorm < 0.88
          ? smoothstep(0.47, 0.54, yNorm) * (1 - smoothstep(0.63, 0.68, yNorm))
          : 0;
      const inRail = yNorm >= 0.54 && yNorm < 0.79 && xNorm > 0.1 && xNorm < 0.9;
      const inArms = yNorm >= 0.14 && yNorm < 0.76 && (xNorm < 0.29 || xNorm > 0.71);
      const edgeSuppress = 1 - edgeBlur[j] * 0.96;
      const seamSuppress = 1 - seamWide[j] * 0.9;

      seamBorrow[j] = clamp((masks.backEdgeSeam[j] * 0.65 + masks.underBackSeam[j] * 0.9) * edgeSuppress, 0, 1);
      armFlatten[j] = clamp((masks.armHighlight[j] * 0.7 + masks.armPocket[j] * 1.0) * edgeSuppress, 0, 1);
      backCenterReduce[j] = clamp(masks.backCenter[j] * (0.75 + 0.25 * masks.highlightGuide[j]), 0, 1);
      railLift[j] = clamp((masks.frontRailLower[j] * 1.0 + masks.lowerShadow[j] * 0.45) * edgeSuppress, 0, 1);
      lowerSeatLift[j] = clamp(lowerSeatBand * seamSuppress * edgeSuppress * (0.55 + 0.45 * (1 - masks.shadowGuide[j])), 0, 1);
      openNoArms[j] = clamp((masks.openField[j] - inArms * 0.65) * edgeSuppress, 0, 1);

      // In shadow-biased lower regions, avoid carrying forward the gray cast from RELIGHT-A.
      if (refL[j] > 74 && (railLift[j] > 0 || lowerSeatLift[j] > 0)) {
        railLift[j] *= 0.85;
        lowerSeatLift[j] *= 0.88;
      }
    }
  }

  const seamBlur = boxBlur(seamBorrow, width, height, 4);
  const armBlur = boxBlur(armFlatten, width, height, 6);
  const centerBlur = boxBlur(backCenterReduce, width, height, 8);
  const railBlur = boxBlur(railLift, width, height, 5);
  const seatBlur = boxBlur(lowerSeatLift, width, height, 5);
  const openBlur = boxBlur(openNoArms, width, height, 6);
  for (let i = 0; i < n; i++) {
    seamBorrow[i] = clamp(seamBlur[i], 0, 1);
    armFlatten[i] = clamp(armBlur[i], 0, 1);
    backCenterReduce[i] = clamp(centerBlur[i], 0, 1);
    railLift[i] = clamp(railBlur[i], 0, 1);
    lowerSeatLift[i] = clamp(seatBlur[i], 0, 1);
    openNoArms[i] = clamp(openBlur[i], 0, 1);
  }

  return { seamBorrow, armFlatten, backCenterReduce, railLift, lowerSeatLift, openNoArms };
}

function applyHybridVariant(
  relightA: RgbaImage,
  relightB: RgbaImage,
  reference: RgbaImage,
  upholstery: Mask,
  tone: ReturnType<typeof analyzeTone>,
  masks: HandMasks,
  correction: CorrectionMasks,
  params: VariantParams,
): RgbaImage {
  const { width, height, channels } = relightA;
  const n = width * height;
  const out = Buffer.from(relightA.data);
  const LA = buildLField(relightA);
  const LB = buildLField(relightB);
  const blurArm = boxBlur(LA, width, height, 10);
  const blurWide = boxBlur(LA, width, height, 16);

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const labA = rgbToLab(relightA.data[p], relightA.data[p + 1], relightA.data[p + 2]);
    let L = labA.L;

    const targetL = mapLThroughCurve(L, tone.basePercentiles, tone.refPercentiles);
    L += (targetL - L) * params.curveStrength * correction.openNoArms[j];

    // Borrow only a restrained amount of additional seam depth from RELIGHT-B.
    L += (LB[j] - LA[j]) * params.seamBorrowStrength * correction.seamBorrow[j];

    // Pull the back cushion modeling back toward the reference instead of pushing contrast.
    L -= params.centerReduce * correction.backCenterReduce[j];

    // Flatten the over-modeled arms by blending them toward a smoother local field.
    const armTarget = blurArm[j] * 0.75 + blurWide[j] * 0.25;
    L = L + (armTarget - L) * params.armFlatten * correction.armFlatten[j];

    // Lift the lower cushion/front-rail open fields to remove the gray cast.
    L += params.railLift * correction.railLift[j];
    L += params.lowerSeatLift * correction.lowerSeatLift[j];
    L += params.lowerShadowNeutralize * masks.lowerShadow[j] * (1 - masks.seamKeep[j]);

    const rgb = labToRgb(clamp(L, 0, 100), labA.a, labA.b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = relightA.data[p + 3];
  }

  return { data: out, width, height, channels };
}

export async function runPhaseRealLeatherRelight2() {
  const { source, image: base6a, upholstery } = await buildPhase6aBase();
  const sourceImage = await loadImageRGBA(SOURCE_OUT);
  const reference = await loadResizedImageRGBA(REALISM_REFERENCE_PATH, base6a.width, base6a.height);
  const relightA = await loadImageRGBA(phaseRealLeatherRelight1VariantPath('A'));
  const relightB = await loadImageRGBA(phaseRealLeatherRelight1VariantPath('B'));
  const tone = analyzeTone(relightA, reference, upholstery);
  const masks = buildHandMasks(source, reference, upholstery);
  const correction = buildCorrectionMasks(source, reference, upholstery, masks);
  const backgroundRing = buildBackgroundRing(upholstery);

  const resultA = applyHybridVariant(relightA, relightB, reference, upholstery, tone, masks, correction, VARIANTS[0]);
  const resultB = applyHybridVariant(relightA, relightB, reference, upholstery, tone, masks, correction, VARIANTS[1]);

  const outA = phaseRealLeatherRelight2VariantPath('A');
  const outB = phaseRealLeatherRelight2VariantPath('B');
  await writeRgbaPng(outA, resultA);
  await writeRgbaPng(outB, resultB);

  const sourceTmp = join(DEBUG_DIR, '_phaseRealLeatherRelight2-source.png');
  const base6aTmp = join(DEBUG_DIR, '_phaseRealLeatherRelight2-base6a.png');
  const referenceTmp = join(DEBUG_DIR, '_phaseRealLeatherRelight2-reference.png');
  const relightATmp = join(DEBUG_DIR, '_phaseRealLeatherRelight2-relightA.png');
  await writeRgbaPng(sourceTmp, sourceImage);
  await writeRgbaPng(base6aTmp, base6a);
  await writeRgbaPng(referenceTmp, reference);
  await writeRgbaPng(relightATmp, relightA);

  await writeCompareGrid(PHASE_REALLEATHER_RELIGHT2_COMPARE_GRID, [
    { path: sourceTmp, label: 'SOURCE' },
    { path: base6aTmp, label: '6A' },
    { path: referenceTmp, label: 'GENERATED REFERENCE' },
    { path: relightATmp, label: 'RELIGHT-A' },
    { path: outA, label: 'RELIGHT2-A' },
    { path: outB, label: 'RELIGHT2-B' },
  ]);

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
    reference: referenceDiagnosticBase,
    relightA: analyzeImage('RELIGHT-A', relightA, upholstery, backgroundRing, masks, referenceDiagnostic),
    relight2A: analyzeImage('RELIGHT2-A', resultA, upholstery, backgroundRing, masks, referenceDiagnostic),
    relight2B: analyzeImage('RELIGHT2-B', resultB, upholstery, backgroundRing, masks, referenceDiagnostic),
  };

  const spec = {
    phase: 'RealLeather Relight 2',
    purpose: 'Restrained hybrid pass based on RELIGHT-A: reduce arm/rail overcorrection, keep only a small seam-depth borrow from RELIGHT-B',
    base: phaseRealLeatherRelight1VariantPath('A'),
    disallowed: ['RELIGHT-B as base', 'texture', 'grain', 'mottle', 'darkening the sofa for fake depth'],
    method: {
      seamBorrow: 'Small RELIGHT-B luminance delta applied only in seam-specific masks',
      armCorrection: 'Flatten arm highlight/pocket contrast toward a smoother local field',
      railCorrection: 'Lift front rail lower field and lower cushion band to remove gray cast',
      cushionCorrection: 'Reduce RELIGHT-A back-center over-modeling toward the reference',
    },
    diagnostics,
    outputs: {
      compareGrid: PHASE_REALLEATHER_RELIGHT2_COMPARE_GRID,
      variantA: outA,
      variantB: outB,
      spec: PHASE_REALLEATHER_RELIGHT2_SPEC,
    },
    variants: [
      {
        ...VARIANTS[0],
        meanLab: meanUpholsteryLab(resultA, upholstery),
        vsRelightA: compareUpholsteryImages(relightA, resultA, upholstery).stats,
        vs6a: compareUpholsteryImages(base6a, resultA, upholstery).stats,
      },
      {
        ...VARIANTS[1],
        meanLab: meanUpholsteryLab(resultB, upholstery),
        vsRelightA: compareUpholsteryImages(relightA, resultB, upholstery).stats,
        vs6a: compareUpholsteryImages(base6a, resultB, upholstery).stats,
      },
    ],
  };

  writeFileSync(PHASE_REALLEATHER_RELIGHT2_SPEC, JSON.stringify(spec, null, 2));
  return { compareGrid: PHASE_REALLEATHER_RELIGHT2_COMPARE_GRID, spec: PHASE_REALLEATHER_RELIGHT2_SPEC, outA, outB };
}
