import { boxBlur, buildLinearL, clamp, rgbToLab } from '../phase5/labUtil.js';
import type { RgbaImage } from '../phase1/segment.js';
import { cropSwatchCenter } from '../phase9/swatchMaps.js';

const BLUR_COLOR_PX = 32;
const BLUR_MOTTLE_IN = 6;
const BLUR_MOTTLE_OUT = 20;
const BLUR_GRAIN_PX = 4;

export interface SwatchDetailLayers {
  /** High-pass grain (fine detail), zero-mean unit std */
  grain: Float32Array;
  /** Band-pass mottle (mid body), zero-mean unit std */
  mottle: Float32Array;
  /** Combined detail driver for L modulation */
  combinedDetail: Float32Array;
  /** Tiny chroma high-pass (restrained) */
  chromaA: Float32Array;
  chromaB: Float32Array;
  /** Lighting-neutral swatch L after color separation */
  neutralL: Float32Array;
  width: number;
  height: number;
}

function zeroMean(field: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += field[i];
  const mean = sum / field.length;
  for (let i = 0; i < field.length; i++) field[i] -= mean;
}

function normalizeStd(field: Float32Array, targetStd = 1): void {
  zeroMean(field);
  let v = 0;
  for (let i = 0; i < field.length; i++) v += field[i] * field[i];
  const std = Math.sqrt(v / field.length) || 1e-6;
  const s = targetStd / std;
  for (let i = 0; i < field.length; i++) field[i] *= s;
}

/**
 * Extract band-pass leather detail from swatch LAB L (not stochastic sampling source).
 * Low-frequency color/lighting removed before high-pass extraction.
 */
export function extractSwatchDetailLayers(swatch: RgbaImage): SwatchDetailLayers {
  const patch = cropSwatchCenter(swatch);
  const { width, height, channels } = patch;
  const n = width * height;
  const L = buildLinearL(patch);
  const blurColor = boxBlur(L, width, height, BLUR_COLOR_PX);

  let meanL = 0;
  for (let j = 0; j < n; j++) meanL += L[j];
  meanL /= n;

  const neutralL = new Float32Array(n);
  for (let j = 0; j < n; j++) neutralL[j] = L[j] - blurColor[j] + meanL;

  const blurFine = boxBlur(neutralL, width, height, BLUR_GRAIN_PX);
  const blurMIn = boxBlur(neutralL, width, height, BLUR_MOTTLE_IN);
  const blurMOut = boxBlur(neutralL, width, height, BLUR_MOTTLE_OUT);

  const grain = new Float32Array(n);
  const mottle = new Float32Array(n);
  const chromaA = new Float32Array(n);
  const chromaB = new Float32Array(n);
  const combinedDetail = new Float32Array(n);

  let meanA = 0;
  let meanB = 0;
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    const lab = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]);
    meanA += lab.a;
    meanB += lab.b;
  }
  meanA /= n;
  meanB /= n;

  const blurA = boxBlur(
    (() => {
      const f = new Float32Array(n);
      for (let j = 0; j < n; j++) {
        const p = j * channels;
        f[j] = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]).a;
      }
      return f;
    })(),
    width,
    height,
    14,
  );
  const blurB = boxBlur(
    (() => {
      const f = new Float32Array(n);
      for (let j = 0; j < n; j++) {
        const p = j * channels;
        f[j] = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]).b;
      }
      return f;
    })(),
    width,
    height,
    14,
  );

  for (let j = 0; j < n; j++) {
    grain[j] = neutralL[j] - blurFine[j];
    mottle[j] = blurMIn[j] - blurMOut[j];
    const p = j * channels;
    const lab = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]);
    chromaA[j] = lab.a - blurA[j];
    chromaB[j] = lab.b - blurB[j];
  }

  normalizeStd(grain, 1);
  normalizeStd(mottle, 1);
  normalizeStd(chromaA, 0.5);
  normalizeStd(chromaB, 0.5);

  for (let j = 0; j < n; j++) {
    combinedDetail[j] = grain[j] * 0.62 + mottle[j] * 0.38;
  }
  normalizeStd(combinedDetail, 1);

  return {
    grain,
    mottle,
    combinedDetail,
    chromaA,
    chromaB,
    neutralL,
    width,
    height,
  };
}

export function detailFieldPreview(field: Float32Array, w: number, h: number): Buffer {
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

/** Bilinear sample with toroidal wrap — continuous, no square patch stamp. */
export function sampleDetailBilinear(
  field: Float32Array,
  pw: number,
  ph: number,
  u: number,
  v: number,
): number {
  const uu = ((u % pw) + pw) % pw;
  const vv = ((v % ph) + ph) % ph;
  const x0 = Math.floor(uu);
  const y0 = Math.floor(vv);
  const x1 = (x0 + 1) % pw;
  const y1 = (y0 + 1) % ph;
  const fx = uu - x0;
  const fy = vv - y0;
  const v00 = field[y0 * pw + x0];
  const v10 = field[y0 * pw + x1];
  const v01 = field[y1 * pw + x0];
  const v11 = field[y1 * pw + x1];
  const a = v00 * (1 - fx) + v10 * fx;
  const b = v01 * (1 - fx) + v11 * fx;
  return a * (1 - fy) + b * fy;
}

/** Map sofa pixel to swatch coords using irrational warp (non-repeating visually). */
export function sofaToSwatchUV(x: number, y: number, scale: number): { u: number; v: number } {
  return {
    u: x * scale * 0.4137 + y * scale * 0.2719 + scale * 17.3,
    v: y * scale * 0.3921 - x * scale * 0.1833 + scale * 31.7,
  };
}
