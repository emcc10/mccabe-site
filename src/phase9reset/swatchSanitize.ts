import { boxBlur, buildLinearL, clamp, labToRgb, rgbToLab } from '../phase5/labUtil.js';
import type { RgbaImage } from '../phase1/segment.js';
import { cropSwatchCenter } from '../phase9/swatchMaps.js';

const BLUR_LIGHT_PX = 28;
const BLUR_MOTTLE_IN = 8;
const BLUR_MOTTLE_OUT = 24;
const BLUR_GRAIN_PX = 3;
const INPAINT_BLUR_PX = 18;
const INPAINT_BLUR_HEAVY_PX = 36;

export interface SwatchCleanValidation {
  ok: boolean;
  diagonalBandScore: number;
  maxDiagonalResidual: number;
  artifactCoverage: number;
  failures: string[];
}

export class SwatchCleanRejectedError extends Error {
  constructor(
    message: string,
    readonly validation: SwatchCleanValidation,
  ) {
    super(message);
    this.name = 'SwatchCleanRejectedError';
  }
}

export interface CleanSwatchMaterial {
  grain: Float32Array;
  mottle: Float32Array;
  colorBiasA: Float32Array;
  colorBiasB: Float32Array;
  artifactMask: Float32Array;
  cleanL: Float32Array;
  cleanBaseRgb: Buffer;
  width: number;
  height: number;
  validation: SwatchCleanValidation;
}

function hashUint(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) >>> 0;
  h = (Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function zeroMean(field: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += field[i];
  const mean = sum / field.length;
  for (let i = 0; i < field.length; i++) field[i] -= mean;
}

function normalizeStd(field: Float32Array, targetStd = 1): void {
  zeroMean(field);
  let varSum = 0;
  for (let i = 0; i < field.length; i++) varSum += field[i] * field[i];
  const std = Math.sqrt(varSum / field.length) || 1e-6;
  const scale = targetStd / std;
  for (let i = 0; i < field.length; i++) field[i] *= scale;
}

function orientedResponse(L: Float32Array, w: number, h: number, x: number, y: number, dx: number, dy: number): number {
  let sum = 0;
  let n = 0;
  for (let k = -3; k <= 3; k++) {
    const xx = x + dx * k;
    const yy = y + dy * k;
    if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
    const j = yy * w + xx;
    const jn = (yy - dy) * w + (xx - dx);
    sum += Math.abs(L[j] - L[jn]);
    n++;
  }
  return n ? sum / n : 0;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** Detect fold lines, diagonal bands, and large directional lighting residuals. */
function buildArtifactMask(
  L: Float32Array,
  flatL: Float32Array,
  w: number,
  h: number,
  percentileCut: number,
): Float32Array {
  const mask = new Float32Array(w * h);
  const samples: number[] = [];

  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const j = y * w + x;
      const r0 = orientedResponse(L, w, h, x, y, 1, 0);
      const r45 = orientedResponse(L, w, h, x, y, 1, 1);
      const r90 = orientedResponse(L, w, h, x, y, 0, 1);
      const r135 = orientedResponse(L, w, h, x, y, 1, -1);
      const axis = (r0 + r90) * 0.5;
      const diag = (r45 + r135) * 0.5;
      const diagDominance = diag / (axis + 0.35);
      const aniso = Math.max(r0, r45, r90, r135) / (Math.min(r0, r45, r90, r135) + 0.5);
      const lightResidual = Math.abs(L[j] - flatL[j]);
      const score =
        diag * 0.42 +
        diagDominance * 2.8 +
        aniso * 0.22 +
        lightResidual * 0.28 +
        Math.max(r0, r90) * 0.08;
      samples.push(score);
    }
  }

  const thresh = percentile(samples, percentileCut);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const j = y * w + x;
      const r0 = orientedResponse(L, w, h, x, y, 1, 0);
      const r45 = orientedResponse(L, w, h, x, y, 1, 1);
      const r90 = orientedResponse(L, w, h, x, y, 0, 1);
      const r135 = orientedResponse(L, w, h, x, y, 1, -1);
      const axis = (r0 + r90) * 0.5;
      const diag = (r45 + r135) * 0.5;
      const diagDominance = diag / (axis + 0.35);
      const aniso = Math.max(r0, r45, r90, r135) / (Math.min(r0, r45, r90, r135) + 0.5);
      const lightResidual = Math.abs(L[j] - flatL[j]);
      const score =
        diag * 0.42 +
        diagDominance * 2.8 +
        aniso * 0.22 +
        lightResidual * 0.28 +
        Math.max(r0, r90) * 0.08;
      if (score >= thresh) mask[j] = 1;
    }
  }

  const dilated = boxBlur(mask, w, h, 5);
  for (let j = 0; j < mask.length; j++) mask[j] = clamp(dilated[j] * 1.45, 0, 1);

  return mask;
}

/** Residual diagonal/fold energy on cleaned luminance — must be low for hero reference. */
export function validateCleanSwatchQuality(
  cleanL: Float32Array,
  artifactMask: Float32Array,
  w: number,
  h: number,
): SwatchCleanValidation {
  const failures: string[] = [];
  let diagSum = 0;
  let axisSum = 0;
  let maxDiagonalResidual = 0;
  let n = 0;
  let artifactPx = 0;

  for (let j = 0; j < artifactMask.length; j++) {
    if (artifactMask[j] > 0.25) artifactPx++;
  }
  const artifactCoverage = artifactPx / artifactMask.length;

  for (let y = 3; y < h - 3; y++) {
    for (let x = 3; x < w - 3; x++) {
      const j = y * w + x;
      const r0 = orientedResponse(cleanL, w, h, x, y, 1, 0);
      const r45 = orientedResponse(cleanL, w, h, x, y, 1, 1);
      const r90 = orientedResponse(cleanL, w, h, x, y, 0, 1);
      const r135 = orientedResponse(cleanL, w, h, x, y, 1, -1);
      const axis = (r0 + r90) * 0.5;
      const diag = (r45 + r135) * 0.5;
      diagSum += diag;
      axisSum += axis;
      maxDiagonalResidual = Math.max(maxDiagonalResidual, diag);
      n++;
    }
  }

  const diagonalBandScore = n ? diagSum / n / (axisSum / n + 0.15) : 0;

  if (diagonalBandScore > 1.02) {
    failures.push(
      `Diagonal band residual too high (score ${diagonalBandScore.toFixed(2)} > 1.02)`,
    );
  }
  if (maxDiagonalResidual > 2.35) {
    failures.push(
      `Visible diagonal fold line (max residual ${maxDiagonalResidual.toFixed(2)} > 2.35)`,
    );
  }

  const blur = boxBlur(cleanL, w, h, 14);
  let bandContrast = 0;
  let bandN = 0;
  for (let j = 0; j < cleanL.length; j++) {
    bandContrast += Math.abs(cleanL[j] - blur[j]);
    bandN++;
  }
  const meanBandContrast = bandN ? bandContrast / bandN : 0;
  if (meanBandContrast > 3.2 && diagonalBandScore > 0.95) {
    failures.push(
      `Broad lighting band remains (contrast ${meanBandContrast.toFixed(2)})`,
    );
  }

  return {
    ok: failures.length === 0,
    diagonalBandScore,
    maxDiagonalResidual,
    artifactCoverage,
    failures,
  };
}

export function assertCleanSwatchPasses(validation: SwatchCleanValidation): void {
  if (validation.ok) return;
  throw new SwatchCleanRejectedError(
    `Clean swatch rejected — ${validation.failures.join('; ')}. Cannot use for hero reference.`,
    validation,
  );
}

/**
 * Sanitize swatch: remove photo folds/lighting, extract isotropic material fields only.
 */
export function buildCleanSwatchMaterial(swatch: RgbaImage): CleanSwatchMaterial {
  const patch = cropSwatchCenter(swatch);
  const { width, height, channels } = patch;
  const n = width * height;
  const L = buildLinearL(patch);
  const blurLight = boxBlur(L, width, height, BLUR_LIGHT_PX);

  let meanL = 0;
  for (let j = 0; j < n; j++) meanL += L[j];
  meanL /= n;

  const flatL = new Float32Array(n);
  for (let j = 0; j < n; j++) flatL[j] = L[j] - blurLight[j] + meanL;

  let artifactMask = new Float32Array(n);
  let cleanL = new Float32Array(n);
  let validation: SwatchCleanValidation = {
    ok: false,
    diagonalBandScore: 99,
    maxDiagonalResidual: 99,
    artifactCoverage: 0,
    failures: ['not validated'],
  };

  const passes = [
    { percentile: 0.76, inpaintPx: INPAINT_BLUR_PX },
    { percentile: 0.7, inpaintPx: INPAINT_BLUR_HEAVY_PX },
    { percentile: 0.64, inpaintPx: INPAINT_BLUR_HEAVY_PX },
  ];

  for (const pass of passes) {
    artifactMask = buildArtifactMask(L, flatL, width, height, pass.percentile);
    const inpaint = boxBlur(flatL, width, height, pass.inpaintPx);
    const heavy = boxBlur(inpaint, width, height, pass.inpaintPx);
    for (let j = 0; j < n; j++) {
      const m = artifactMask[j];
      const blended = inpaint[j] * 0.55 + heavy[j] * 0.45;
      cleanL[j] = flatL[j] * (1 - m) + blended * m;
    }
    validation = validateCleanSwatchQuality(cleanL, artifactMask, width, height);
    if (validation.ok) break;
  }

  assertCleanSwatchPasses(validation);

  const blurMottleIn = boxBlur(cleanL, width, height, BLUR_MOTTLE_IN);
  const blurMottleOut = boxBlur(cleanL, width, height, BLUR_MOTTLE_OUT);
  const blurFine = boxBlur(cleanL, width, height, BLUR_GRAIN_PX);

  const grain = new Float32Array(n);
  const mottle = new Float32Array(n);
  const colorBiasA = new Float32Array(n);
  const colorBiasB = new Float32Array(n);

  let meanA = 0;
  let meanB = 0;
  let chromaN = 0;
  for (let j = 0; j < n; j++) {
    if (artifactMask[j] > 0.35) continue;
    const p = j * channels;
    const lab = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]);
    meanA += lab.a;
    meanB += lab.b;
    chromaN++;
  }
  if (!chromaN) chromaN = n;
  meanA /= chromaN;
  meanB /= chromaN;

  const flatRgb = Buffer.alloc(n * 3);
  for (let j = 0; j < n; j++) {
    const rgb = labToRgb(cleanL[j], meanA, meanB);
    const o = j * 3;
    flatRgb[o] = rgb.r;
    flatRgb[o + 1] = rgb.g;
    flatRgb[o + 2] = rgb.b;
  }

  for (let j = 0; j < n; j++) {
    grain[j] = cleanL[j] - blurFine[j];
    mottle[j] = blurMottleIn[j] - blurMottleOut[j];
    const p = j * channels;
    const lab = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]);
    const suppress = 1 - artifactMask[j] * 0.85;
    colorBiasA[j] = (lab.a - meanA) * suppress;
    colorBiasB[j] = (lab.b - meanB) * suppress;
  }

  const blurA = boxBlur(colorBiasA, width, height, 10);
  const blurB = boxBlur(colorBiasB, width, height, 10);
  for (let j = 0; j < n; j++) {
    colorBiasA[j] = colorBiasA[j] - blurA[j];
    colorBiasB[j] = colorBiasB[j] - blurB[j];
  }

  normalizeStd(grain, 1);
  normalizeStd(mottle, 1);
  normalizeStd(colorBiasA, 0.6);
  normalizeStd(colorBiasB, 0.6);

  return {
    grain,
    mottle,
    colorBiasA,
    colorBiasB,
    artifactMask,
    cleanL,
    cleanBaseRgb: flatRgb,
    width,
    height,
    validation,
  };
}

/** Stochastic multi-offset sampling — no literal square tiling. */
export function sampleCleanMaterial(
  field: Float32Array,
  pw: number,
  ph: number,
  x: number,
  y: number,
  baseScale: number,
  seed: number,
): number {
  const blends = 5;
  let sum = 0;
  for (let k = 0; k < blends; k++) {
    const h0 = hashUint(Math.floor(x * 2.17 + k * 11), Math.floor(y * 3.41), seed + k * 19);
    const h1 = hashUint(Math.floor(x * 5.03), Math.floor(y * 1.73 + k * 7), seed + k * 37 + 3);
    const h2 = hashUint(x, y, seed + k * 53 + 9);
    const ox = h0 % pw;
    const oy = h1 % ph;
    const scale = baseScale * (0.78 + (h2 % 1000) / 2500);
    const u = (Math.floor(x * scale + ox + k * 2.3) % pw + pw) % pw;
    const v = (Math.floor(y * scale * 1.091 + oy + k * 1.7) % ph + ph) % ph;
    sum += field[v * pw + u];
  }
  return sum / blends;
}

export function fieldToGrayPreview(field: Float32Array, w: number, h: number): Buffer {
  let min = Infinity;
  let max = -Infinity;
  for (const v of field) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const span = Math.max(max - min, 1e-6);
  const buf = Buffer.alloc(w * h * 3);
  for (let j = 0; j < field.length; j++) {
    const t = clamp((field[j] - min) / span, 0, 1);
    const v = Math.round(t * 255);
    const o = j * 3;
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
  }
  return buf;
}

export function colorBiasPreview(a: Float32Array, b: Float32Array, w: number, h: number): Buffer {
  const buf = Buffer.alloc(w * h * 3);
  for (let j = 0; j < a.length; j++) {
    const o = j * 3;
    buf[o] = clamp(128 + a[j] * 22, 0, 255);
    buf[o + 1] = clamp(128 + b[j] * 22, 0, 255);
    buf[o + 2] = 128;
  }
  return buf;
}

export function artifactMaskPreview(mask: Float32Array, w: number, h: number): Buffer {
  const buf = Buffer.alloc(w * h * 3);
  for (let j = 0; j < mask.length; j++) {
    const v = Math.round(clamp(mask[j], 0, 1) * 255);
    const o = j * 3;
    buf[o] = v;
    buf[o + 1] = Math.round(v * 0.35);
    buf[o + 2] = 0;
  }
  return buf;
}
