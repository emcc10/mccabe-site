import { boxBlur, buildLinearL, clamp, rgbToLab } from '../phase5/labUtil.js';
import type { RgbaImage } from '../phase1/segment.js';

const SWATCH_CROP_FRAC = 0.72;
const BLUR_LIGHT_PX = 26;
const BLUR_MOTTLE_INNER = 7;
const BLUR_MOTTLE_OUTER = 22;
const BLUR_GRAIN_PX = 3;

export interface SwatchDerivedMaps {
  grain: Float32Array;
  mottle: Float32Array;
  colorBiasA: Float32Array;
  colorBiasB: Float32Array;
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
  let varSum = 0;
  for (let i = 0; i < field.length; i++) varSum += field[i] * field[i];
  const std = Math.sqrt(varSum / field.length) || 1e-6;
  const scale = targetStd / std;
  for (let i = 0; i < field.length; i++) field[i] *= scale;
}

/** Crop center of swatch to reduce photo lighting vignette. */
export function cropSwatchCenter(swatch: RgbaImage): RgbaImage {
  const { width, height, channels } = swatch;
  const cw = Math.max(32, Math.floor(width * SWATCH_CROP_FRAC));
  const ch = Math.max(32, Math.floor(height * SWATCH_CROP_FRAC));
  const x0 = Math.floor((width - cw) / 2);
  const y0 = Math.floor((height - ch) / 2);
  const data = Buffer.alloc(cw * ch * channels);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const sj = (y0 + y) * width + (x0 + x);
      const dj = y * cw + x;
      const sp = sj * channels;
      const dp = dj * channels;
      for (let c = 0; c < channels; c++) data[dp + c] = swatch.data[sp + c];
    }
  }
  return { data, width: cw, height: ch, channels };
}

/**
 * Grain / mottle / color bias from real Bali Silk swatch (luminance-separated, zero-mean).
 */
export function buildSwatchDerivedMaps(swatch: RgbaImage): SwatchDerivedMaps {
  const patch = cropSwatchCenter(swatch);
  const { width, height, channels } = patch;
  const n = width * height;
  const L = buildLinearL(patch);
  const blurLight = boxBlur(L, width, height, BLUR_LIGHT_PX);
  const blurMottleIn = boxBlur(L, width, height, BLUR_MOTTLE_INNER);
  const blurMottleOut = boxBlur(L, width, height, BLUR_MOTTLE_OUTER);
  const blurFine = boxBlur(L, width, height, BLUR_GRAIN_PX);

  const grain = new Float32Array(n);
  const mottle = new Float32Array(n);
  const colorBiasA = new Float32Array(n);
  const colorBiasB = new Float32Array(n);

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

  for (let j = 0; j < n; j++) {
    grain[j] = L[j] - blurFine[j];
    mottle[j] = blurMottleIn[j] - blurMottleOut[j];
    const p = j * channels;
    const lab = rgbToLab(patch.data[p], patch.data[p + 1], patch.data[p + 2]);
    colorBiasA[j] = lab.a - meanA;
    colorBiasB[j] = lab.b - meanB;
  }

  normalizeStd(grain, 1);
  normalizeStd(mottle, 1);
  normalizeStd(colorBiasA, 1);
  normalizeStd(colorBiasB, 1);

  return { grain, mottle, colorBiasA, colorBiasB, width, height };
}

export function sampleTiled(
  field: Float32Array,
  pw: number,
  ph: number,
  x: number,
  y: number,
  scale: number,
): number {
  const u = ((Math.floor(x * scale) % pw) + pw) % pw;
  const v = ((Math.floor(y * scale) % ph) + ph) % ph;
  return field[v * pw + u];
}

export function swatchMapToPreviewBuffer(
  field: Float32Array,
  width: number,
  height: number,
): Buffer {
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < field.length; j++) {
    min = Math.min(min, field[j]);
    max = Math.max(max, field[j]);
  }
  const span = Math.max(max - min, 1e-6);
  const buf = Buffer.alloc(width * height * 3);
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
