import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { boxBlur, buildLinearL, clamp, labToRgb, rgbToLab } from '../phase5/labUtil.js';

export interface RealismV2Params {
  detailStrength: number;
  highlightStrength: number;
  aVarAmp: number;
  bVarAmp: number;
  seamBoost: number;
  fineBlurPx: number;
  coarseBlurPx: number;
}

export interface SourceTextureMapsV2 {
  lDetailFine: Float32Array;
  lDetailCoarse: Float32Array;
  seamWeight: Float32Array;
  highlight: Float32Array;
  aResidual: Float32Array;
  bResidual: Float32Array;
}

export function buildSourceTextureMapsV2(
  source: RgbaImage,
  upholstery: Mask,
  fineBlurPx: number,
  coarseBlurPx: number,
): SourceTextureMapsV2 {
  const { width, height } = source;
  const n = width * height;
  const L = buildLinearL(source);
  const blurFine = boxBlur(L, width, height, fineBlurPx);
  const blurCoarse = boxBlur(L, width, height, coarseBlurPx);

  const lDetailFine = new Float32Array(n);
  const lDetailCoarse = new Float32Array(n);
  const seamWeight = new Float32Array(n);
  const highlight = new Float32Array(n);
  const aVals: number[] = [];
  const bVals: number[] = [];

  let coarseSum = 0;
  let coarseCount = 0;
  let fineMax = 1e-6;

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * source.channels;
    const lab = rgbToLab(source.data[p], source.data[p + 1], source.data[p + 2]);
    const fine = L[j] - blurFine[j];
    const coarse = L[j] - blurCoarse[j];
    lDetailFine[j] = fine;
    lDetailCoarse[j] = coarse;
    fineMax = Math.max(fineMax, Math.abs(fine));
    coarseSum += coarse;
    coarseCount++;
    aVals.push(lab.a);
    bVals.push(lab.b);
    const bright = clamp((L[j] - 58) / 34, 0, 1);
    highlight[j] = bright * (1 - 0.2 * bright);
  }

  const coarseMean = coarseCount ? coarseSum / coarseCount : 0;
  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    lDetailCoarse[j] -= coarseMean;
    seamWeight[j] = Math.abs(lDetailFine[j]) / fineMax;
  }

  const aMean = aVals.length ? aVals.reduce((s, v) => s + v, 0) / aVals.length : 0;
  const bMean = bVals.length ? bVals.reduce((s, v) => s + v, 0) / bVals.length : 0;
  let aMax = 1e-6;
  let bMax = 1e-6;
  for (const v of aVals) aMax = Math.max(aMax, Math.abs(v - aMean));
  for (const v of bVals) bMax = Math.max(bMax, Math.abs(v - bMean));

  const aResidual = new Float32Array(n);
  const bResidual = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * source.channels;
    const lab = rgbToLab(source.data[p], source.data[p + 1], source.data[p + 2]);
    aResidual[j] = (lab.a - aMean) / aMax;
    bResidual[j] = (lab.b - bMean) / bMax;
  }

  return { lDetailFine, lDetailCoarse, seamWeight, highlight, aResidual, bResidual };
}

/** Material realism v2 — stronger HF detail, seam-weighted, softer highlight lift. */
export function applyRealismPassV2(
  base: RgbaImage,
  upholstery: Mask,
  maps: SourceTextureMapsV2,
  params: RealismV2Params,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);

    const seamMul = 1 + params.seamBoost * maps.seamWeight[j];
    let L =
      lab.L +
      params.detailStrength * maps.lDetailCoarse[j] +
      params.detailStrength * 0.85 * maps.lDetailFine[j] * seamMul;

    const hi = maps.highlight[j];
    L += params.highlightStrength * 7.5 * hi * (1 - 0.35 * hi);

    const a = lab.a + params.aVarAmp * maps.aResidual[j];
    const b = lab.b + params.bVarAmp * maps.bResidual[j];

    const rgb = labToRgb(L, a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = base.data[p + 3];
  }

  return { data: out, width, height, channels };
}
