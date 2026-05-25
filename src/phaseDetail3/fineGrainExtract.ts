import { boxBlur, buildLinearL, clamp, rgbToLab } from '../phase5/labUtil.js';
import type { RgbaImage } from '../phase1/segment.js';
import { cropSwatchCenter } from '../phase9/swatchMaps.js';

const BLUR_COLOR_PX = 32;
/** Finer high-pass grain (L - blur(2)). */
const BLUR_GRAIN_PX = 2;
/** Heavily damped mottle band — kept for optional tiny mix only. */
const BLUR_MOTTLE_IN = 8;
const BLUR_MOTTLE_OUT = 28;
const MOTTLE_DAMP = 0.18;

export interface FineGrainLayers {
  grain: Float32Array;
  mottle: Float32Array;
  chromaA: Float32Array;
  chromaB: Float32Array;
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

/** Fine-grain dominant swatch extract — minimal broad mottle. */
export function extractFineGrainLayers(swatch: RgbaImage): FineGrainLayers {
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

  const aField = new Float32Array(n);
  const bField = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    const lab = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]);
    aField[j] = lab.a;
    bField[j] = lab.b;
  }
  const blurA = boxBlur(aField, width, height, 14);
  const blurB = boxBlur(bField, width, height, 14);

  for (let j = 0; j < n; j++) {
    grain[j] = neutralL[j] - blurFine[j];
    mottle[j] = (blurMIn[j] - blurMOut[j]) * MOTTLE_DAMP;
    chromaA[j] = aField[j] - blurA[j];
    chromaB[j] = bField[j] - blurB[j];
  }

  normalizeStd(grain, 1);
  normalizeStd(mottle, 1);
  normalizeStd(chromaA, 0.4);
  normalizeStd(chromaB, 0.4);

  return { grain, mottle, chromaA, chromaB, width, height };
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

export { sampleDetailBilinear } from '../phaseDetail/swatchDetailExtract.js';
