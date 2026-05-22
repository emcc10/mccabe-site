import type { Mask } from '../phase1/masks.js';
import { erode } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { boxBlur, buildLinearL, clamp, labToRgb, rgbToLab } from '../phase5/labUtil.js';

/** Low form: 18–28px band (center 22). */
const BLUR_LOW_PX = 22;
/** Mid / high split: 4–6px band (center 5). */
const BLUR_FINE_PX = 5;

export interface FreqMaterialParams {
  lowStrength: number;
  midStrength: number;
  highStrength: number;
  /** Higher = stricter gating (fewer pixels get full high-frequency seam boost). */
  highConfidencePercentile: number;
}

export interface FreqLayers {
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  highConfidence: Float32Array;
}

function zeroMeanOverUpholstery(field: Float32Array, upholstery: Mask): void {
  let sum = 0;
  let n = 0;
  for (let j = 0; j < field.length; j++) {
    if (upholstery.data[j] < 128) continue;
    sum += field[j];
    n++;
  }
  if (!n) return;
  const mean = sum / n;
  for (let j = 0; j < field.length; j++) {
    if (upholstery.data[j] < 128) continue;
    field[j] -= mean;
  }
}

function percentileMasked(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/**
 * Frequency-separated layers from source luminance (upholstery only, zero-mean).
 * low = broad form, mid = leather body band, high = fine residual.
 */
export function buildFreqLayers(source: RgbaImage, upholstery: Mask): FreqLayers {
  const { width, height } = source;
  const n = width * height;
  const sourceL = buildLinearL(source);
  const blurLow = boxBlur(sourceL, width, height, BLUR_LOW_PX);
  const blurFine = boxBlur(sourceL, width, height, BLUR_FINE_PX);

  const low = new Float32Array(n);
  const mid = new Float32Array(n);
  const high = new Float32Array(n);
  const highConfidence = new Float32Array(n);

  const upholInterior = erode(upholstery, 4);
  const confSamples: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      low[j] = blurLow[j];
      mid[j] = blurFine[j] - blurLow[j];
      high[j] = sourceL[j] - blurFine[j];

      const gradX = Math.abs(sourceL[j + 1] - sourceL[j - 1]);
      const gradY = Math.abs(sourceL[(y + 1) * width + x] - sourceL[(y - 1) * width + x]);
      const grad = gradX + gradY;
      const absHigh = Math.abs(high[j]);
      const absMid = Math.abs(mid[j]);
      const crease = Math.max(0, absHigh - 0.35 * absMid);
      const edge = Math.max(0, grad - 4);
      const raw = crease * 0.65 + edge * 0.35;

      if (upholInterior.data[j] >= 128) confSamples.push(raw);
    }
  }

  zeroMeanOverUpholstery(low, upholstery);
  zeroMeanOverUpholstery(mid, upholstery);
  zeroMeanOverUpholstery(high, upholstery);

  const confThreshold = percentileMasked(confSamples, 0.52);
  let confMax = 1e-6;
  for (const v of confSamples) confMax = Math.max(confMax, Math.max(0, v - confThreshold));

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      const gradX = Math.abs(sourceL[j + 1] - sourceL[j - 1]);
      const gradY = Math.abs(sourceL[(y + 1) * width + x] - sourceL[(y - 1) * width + x]);
      const grad = gradX + gradY;
      const absHigh = Math.abs(high[j]);
      const absMid = Math.abs(mid[j]);
      const crease = Math.max(0, absHigh - 0.35 * absMid);
      const edge = Math.max(0, grad - 4);
      const raw = crease * 0.65 + edge * 0.35;

      if (upholInterior.data[j] >= 128 && raw > confThreshold) {
        highConfidence[j] = (raw - confThreshold) / confMax;
      }
    }
  }

  const confBlur = boxBlur(highConfidence, width, height, 2);
  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    highConfidence[j] = clamp(confBlur[j], 0, 1);
  }

  return { low, mid, high, highConfidence };
}

/** Apply gated frequency recovery to recolored base L (a/b unchanged). */
export function applyFreqMaterial(
  base: RgbaImage,
  upholstery: Mask,
  layers: FreqLayers,
  params: FreqMaterialParams,
  bottomGuard?: Mask,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;
  const { low, mid, high, highConfidence } = layers;

  const confCut = percentileMasked(
    (() => {
      const vals: number[] = [];
      for (let j = 0; j < highConfidence.length; j++) {
        if (upholstery.data[j] >= 128 && highConfidence[j] > 0.02) vals.push(highConfidence[j]);
      }
      return vals;
    })(),
    params.highConfidencePercentile,
  );

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;

    let guard = 1;
    if (bottomGuard && bottomGuard.data[j] >= 128) guard = 0.35;

    const p = j * channels;
    const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);
    let L = lab.L;

    L += guard * params.lowStrength * low[j];
    L += guard * params.midStrength * mid[j];

    const hiGate =
      highConfidence[j] <= confCut
        ? highConfidence[j] / Math.max(confCut, 1e-6)
        : 1 + 0.25 * (highConfidence[j] - confCut);
    const gatedHigh = high[j] * clamp(hiGate, 0, 1.15);
    L += guard * params.highStrength * gatedHigh;

    const rgb = labToRgb(L, lab.a, lab.b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = base.data[p + 3];
  }

  return { data: out, width, height, channels };
}

export function freqLayerToPreviewBuffer(
  field: Float32Array,
  upholstery: Mask,
  width: number,
  height: number,
): Buffer {
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < field.length; j++) {
    if (upholstery.data[j] < 128) continue;
    min = Math.min(min, field[j]);
    max = Math.max(max, field[j]);
  }
  const span = Math.max(max - min, 1e-6);
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const o = j * 3;
    if (upholstery.data[j] < 128) {
      buf[o] = 24;
      buf[o + 1] = 24;
      buf[o + 2] = 28;
      continue;
    }
    const t = clamp((field[j] - min) / span, 0, 1);
    const v = Math.round(t * 255);
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
  }
  return buf;
}

export function highConfidenceMaskToRgb(
  confidence: Float32Array,
  upholstery: Mask,
  width: number,
  height: number,
): Buffer {
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const o = j * 3;
    if (upholstery.data[j] < 128) {
      buf[o] = 28;
      buf[o + 1] = 28;
      buf[o + 2] = 32;
      continue;
    }
    const v = Math.round(clamp(confidence[j], 0, 1) * 255);
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
  }
  return buf;
}
