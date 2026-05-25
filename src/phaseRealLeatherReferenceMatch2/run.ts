import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, erode, intersect, subtract, union } from '../phase1/masks.js';
import { DEBUG_DIR } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { boxBlur, buildLinearL, clamp, labToRgb, meanUpholsteryLab, rgbToLab } from '../phase5/labUtil.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';
import { loadImageRGBA } from '../recolor/imageIO.js';

const REALLEATHER2_B_PATH = join(DEBUG_DIR, 'phaseRealLeather2-variant-B.png');
const REALLEATHER_REF_A_PATH = join(DEBUG_DIR, 'phaseRealLeatherReferenceMatch-variant-A.png');
const REALLEATHER_REF_B_PATH = join(DEBUG_DIR, 'phaseRealLeatherReferenceMatch-variant-B.png');

export const PHASE_REALLEATHER_REF2_COMPARE_GRID = join(DEBUG_DIR, 'phaseRealLeatherReferenceMatch2-compare-grid.png');
export const PHASE_REALLEATHER_REF2_SPEC = join(DEBUG_DIR, 'phaseRealLeatherReferenceMatch2-spec.json');

export function phaseRealLeatherRef2VariantPath(id: string) {
  return join(DEBUG_DIR, `phaseRealLeatherReferenceMatch2-variant-${id}.png`);
}

interface VariantParams {
  id: 'A' | 'B';
  label: string;
  mixRefA: number;
  mixRl2Base: number;
  mixRl2Highlight: number;
  mixRl2Upper: number;
  globalPull: number;
  upperPull: number;
  highlightClamp: number;
  seamRestore: number;
  contrastKeep: number;
  topKnee: number;
  topCompress: number;
}

const VARIANTS: VariantParams[] = [
  {
    id: 'A',
    label: 'REALLEATHER-REF2-A',
    mixRefA: 0.15,
    mixRl2Base: 0.0,
    mixRl2Highlight: 0.0,
    mixRl2Upper: 0.0,
    globalPull: 0.18,
    upperPull: 0.52,
    highlightClamp: 0.68,
    seamRestore: 0.82,
    contrastKeep: 0.08,
    topKnee: 81.8,
    topCompress: 0.76,
  },
  {
    id: 'B',
    label: 'REALLEATHER-REF2-B',
    mixRefA: 0.0,
    mixRl2Base: 0.12,
    mixRl2Highlight: 0.1,
    mixRl2Upper: 0.07,
    globalPull: 0.12,
    upperPull: 0.64,
    highlightClamp: 0.9,
    seamRestore: 0.9,
    contrastKeep: 0.16,
    topKnee: 81.2,
    topCompress: 0.68,
  },
];

interface RefinementMaps {
  openField: Float32Array;
  upperBackLift: Float32Array;
  highlightClamp: Float32Array;
  seamKeep: Float32Array;
  contrastHold: Float32Array;
  bottomGuard: Mask;
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

function buildRefinementMaps(source: RgbaImage, refB: RgbaImage, upholstery: Mask, lower12: Mask): RefinementMaps {
  const { width, height } = source;
  const n = width * height;
  const openField = new Float32Array(n);
  const upperBackLift = new Float32Array(n);
  const highlightClamp = new Float32Array(n);
  const seamKeep = new Float32Array(n);
  const contrastHold = new Float32Array(n);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const bb = bbox(upholstery);
  if (!bb) return { openField, upperBackLift, highlightClamp, seamKeep, contrastHold, bottomGuard };

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);
  const gates = buildSourceStructureGates(source, upholstery);
  const seamWide = boxBlur(gates.seamEdge, width, height, 10);
  const sourceHighlightWide = boxBlur(gates.highlight, width, height, 14);

  const edgeMask = subtract(upholstery, erode(upholstery, 4));
  const edgeField = new Float32Array(n);
  for (let j = 0; j < n; j++) edgeField[j] = edgeMask.data[j] >= 128 ? 1 : 0;
  const edgeBlur = boxBlur(edgeField, width, height, 5);

  const sourceL = buildLinearL(source);
  const refBL = buildLinearL(refB);
  const blurNear = boxBlur(sourceL, width, height, 6);
  const blurFar = boxBlur(sourceL, width, height, 24);

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128 || bottomGuard.data[j] >= 128) continue;

      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;
      const inBack = yNorm < 0.5 && xNorm > 0.14 && xNorm < 0.86;
      const inArm = yNorm >= 0.14 && yNorm < 0.72 && (xNorm < 0.3 || xNorm > 0.7);
      const inSeat = yNorm >= 0.3 && yNorm < 0.62;
      const inRail = yNorm >= 0.5 && yNorm < 0.76 && xNorm > 0.1 && xNorm < 0.9;

      const open = inBack || inArm || inSeat || inRail ? 1 : 0;
      const backCenters =
        gaussian1d(xNorm, 0.2, 0.095) + gaussian1d(xNorm, 0.5, 0.095) + gaussian1d(xNorm, 0.8, 0.095);
      const backTopBand = smoothstep(0.08, 0.18, yNorm) * (1 - smoothstep(0.34, 0.48, yNorm));
      const backLift = inBack ? backCenters * backTopBand : 0;
      const seatTopFront = inSeat ? gaussian1d(yNorm, 0.46, 0.07) : 0;
      const armRoll = inArm ? gaussian1d(yNorm, 0.42, 0.12) : 0;

      const signedForm = clamp((blurNear[j] - blurFar[j]) / 9, -1, 1);
      const pocket = clamp(-signedForm, 0, 1);
      const edgeSuppress = 1 - edgeBlur[j] * 0.97;
      const seamSuppress = 1 - seamWide[j] * 0.94;
      const brightMask = smoothstep(76, 86, refBL[j]);

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

      openField[j] = open * edgeSuppress;
      upperBackLift[j] = clamp(backLift * edgeSuppress * seamSuppress, 0, 1);
      highlightClamp[j] = clamp(
        brightMask *
          edgeSuppress *
          seamSuppress *
          (0.52 * upperBackLift[j] + 0.2 * seatTopFront + 0.22 * armRoll + 0.24 * sourceHighlightWide[j]),
        0,
        1,
      );
      seamKeep[j] = clamp(
        edgeSuppress *
          (0.45 * seamWide[j] +
            0.45 * pocket +
            0.38 * verticalBackGaps +
            0.42 * underBackSeam +
            0.4 * horizontalBreak +
            0.28 * lowerRailShadow +
            0.3 * insideArmCurves),
        0,
        1,
      );
      contrastHold[j] = clamp(open * edgeSuppress * (0.45 * Math.abs(signedForm) + 0.28 * seamWide[j]), 0, 1);
    }
  }

  const upperBlur = boxBlur(upperBackLift, width, height, 8);
  const highlightBlur = boxBlur(highlightClamp, width, height, 6);
  const seamBlur = boxBlur(seamKeep, width, height, 4);
  const contrastBlur = boxBlur(contrastHold, width, height, 4);
  for (let i = 0; i < n; i++) {
    upperBackLift[i] = clamp(upperBlur[i], 0, 1);
    highlightClamp[i] = clamp(highlightBlur[i], 0, 1);
    seamKeep[i] = clamp(seamBlur[i], 0, 1);
    contrastHold[i] = clamp(contrastBlur[i], 0, 1);
  }

  return { openField, upperBackLift, highlightClamp, seamKeep, contrastHold, bottomGuard };
}

function applyReferenceMatch2Variant(
  refA: RgbaImage,
  refB: RgbaImage,
  realLeather2B: RgbaImage,
  upholstery: Mask,
  maps: RefinementMaps,
  params: VariantParams,
): RgbaImage {
  const out = Buffer.from(refB.data);
  const { width, height, channels } = refB;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128 || maps.bottomGuard.data[j] >= 128) continue;

    const p = j * channels;
    const refBLab = rgbToLab(refB.data[p], refB.data[p + 1], refB.data[p + 2]);
    const refALab = rgbToLab(refA.data[p], refA.data[p + 1], refA.data[p + 2]);
    const rl2Lab = rgbToLab(realLeather2B.data[p], realLeather2B.data[p + 1], realLeather2B.data[p + 2]);

    const open = maps.openField[j];
    const upper = maps.upperBackLift[j];
    const highlight = maps.highlightClamp[j];
    const seam = maps.seamKeep[j];
    const contrast = maps.contrastHold[j];

    const mixRefA = params.mixRefA * open * (1 - seam * 0.45);
    const mixRl2 =
      clamp(params.mixRl2Base + params.mixRl2Highlight * highlight + params.mixRl2Upper * upper, 0, 0.28) *
      open *
      (1 - seam * 0.75);

    let L = refBLab.L;
    let a = refBLab.a;
    let b = refBLab.b;

    if (mixRefA > 0) {
      L = mix(L, refALab.L, mixRefA);
      a = mix(a, refALab.a, mixRefA * 0.92);
      b = mix(b, refALab.b, mixRefA * 0.92);
    }
    if (mixRl2 > 0) {
      L = mix(L, rl2Lab.L, mixRl2);
      a = mix(a, rl2Lab.a, mixRl2 * 0.85);
      b = mix(b, rl2Lab.b, mixRl2 * 0.85);
    }

    L = mix(L, refBLab.L, params.seamRestore * seam);

    const pull =
      params.globalPull * open * (1 - seam * 0.45) +
      params.upperPull * upper * (1 - seam * 0.72) +
      params.highlightClamp * highlight * (1 - seam * 0.65);
    L -= pull;

    const kneeMix = smoothstep(params.topKnee, params.topKnee + 5, L);
    const clampedTop = params.topKnee + (L - params.topKnee) * params.topCompress;
    L = mix(L, clampedTop, kneeMix);

    // Keep the stronger REF-B seam/form separation while dialing down washout on open panels.
    const contrastDelta = clamp(refBLab.L - rl2Lab.L, -1.5, 1.5);
    L += params.contrastKeep * contrast * (1 - highlight * 0.5) * contrastDelta;

    const rgb = labToRgb(clamp(L, 0, 100), a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = refB.data[p + 3];
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

async function writeCompareGrid(outPath: string, panels: { path: string; label: string }[]) {
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

export async function runPhaseRealLeatherReferenceMatch2() {
  const { source, image: base6a, upholstery, lower12 } = await buildPhase6aBase();
  const realLeather2B = await loadImageRGBA(REALLEATHER2_B_PATH);
  const refA = await loadImageRGBA(REALLEATHER_REF_A_PATH);
  const refB = await loadImageRGBA(REALLEATHER_REF_B_PATH);
  const maps = buildRefinementMaps(source, refB, upholstery, lower12);

  const base6aTmp = join(DEBUG_DIR, '_phaseRealLeatherReferenceMatch2-base6a.png');
  await writeRgbaPng(base6aTmp, base6a);

  const results: {
    id: string;
    label: string;
    path: string;
    params: Omit<VariantParams, 'id' | 'label'>;
    vs6a: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsRealLeather2B: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsRefA: ReturnType<typeof compareUpholsteryImages>['stats'];
    vsRefB: ReturnType<typeof compareUpholsteryImages>['stats'];
    meanLab: { meanL: number; meanA: number; meanB: number; count: number };
  }[] = [];

  for (const variant of VARIANTS) {
    const image = applyReferenceMatch2Variant(refA, refB, realLeather2B, upholstery, maps, variant);
    const path = phaseRealLeatherRef2VariantPath(variant.id);
    await writeRgbaPng(path, image);

    results.push({
      id: variant.id,
      label: variant.label,
      path,
      params: {
        mixRefA: variant.mixRefA,
        mixRl2Base: variant.mixRl2Base,
        mixRl2Highlight: variant.mixRl2Highlight,
        mixRl2Upper: variant.mixRl2Upper,
        globalPull: variant.globalPull,
        upperPull: variant.upperPull,
        highlightClamp: variant.highlightClamp,
        seamRestore: variant.seamRestore,
        contrastKeep: variant.contrastKeep,
        topKnee: variant.topKnee,
        topCompress: variant.topCompress,
      },
      vs6a: compareUpholsteryImages(base6a, image, upholstery).stats,
      vsRealLeather2B: compareUpholsteryImages(realLeather2B, image, upholstery).stats,
      vsRefA: compareUpholsteryImages(refA, image, upholstery).stats,
      vsRefB: compareUpholsteryImages(refB, image, upholstery).stats,
      meanLab: meanUpholsteryLab(image, upholstery),
    });
  }

  await writeCompareGrid(PHASE_REALLEATHER_REF2_COMPARE_GRID, [
    { path: base6aTmp, label: '6A' },
    { path: REALLEATHER2_B_PATH, label: 'REALLEATHER2-B' },
    { path: REALLEATHER_REF_A_PATH, label: 'REALLEATHER-REF-A' },
    { path: REALLEATHER_REF_B_PATH, label: 'REALLEATHER-REF-B' },
    { path: phaseRealLeatherRef2VariantPath('A'), label: 'REALLEATHER-REF2-A' },
    { path: phaseRealLeatherRef2VariantPath('B'), label: 'REALLEATHER-REF2-B' },
  ]);

  const spec = {
    phase: 'RealLeather Reference Match 2',
    purpose: 'Tone down REF-B washout while preserving seam depth and catalog-leather behavior',
    base: 'REALLEATHER-REF-B',
    preserves: [
      'smooth leather surface',
      'satin highlight behavior',
      'improved cushion depth',
      'clean catalog look',
      'no visible grain pattern',
      'no blotchy or stamped texture',
    ],
    adjustments: [
      'slight global brightness pull-down',
      'stronger high-end clamp on upper cushion highlights',
      'seam and shadow preservation during blend-back',
      'blend toward REF-A and REALLEATHER2-B only in controlled open fields',
    ],
    outputs: {
      variants: [phaseRealLeatherRef2VariantPath('A'), phaseRealLeatherRef2VariantPath('B')],
      compareGrid: PHASE_REALLEATHER_REF2_COMPARE_GRID,
      spec: PHASE_REALLEATHER_REF2_SPEC,
    },
    variants: results,
  };

  writeFileSync(PHASE_REALLEATHER_REF2_SPEC, JSON.stringify(spec, null, 2));
  return { compareGrid: PHASE_REALLEATHER_REF2_COMPARE_GRID, spec: PHASE_REALLEATHER_REF2_SPEC, results };
}
