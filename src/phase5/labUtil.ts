import convert from 'color-convert';
import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const rad = Math.max(1, Math.round(radius));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dx = -rad; dx <= rad; dx++) {
        const xx = Math.max(0, Math.min(w - 1, x + dx));
        s += src[y * w + xx];
      }
      tmp[y * w + x] = s / (rad * 2 + 1);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = -rad; dy <= rad; dy++) {
        const yy = Math.max(0, Math.min(h - 1, y + dy));
        s += tmp[yy * w + x];
      }
      out[y * w + x] = s / (rad * 2 + 1);
    }
  }
  return out;
}

/** Linear luminance 0–100 (matches detail-map convention). */
export function buildLinearL(image: RgbaImage): Float32Array {
  const n = image.width * image.height;
  const L = new Float32Array(n);
  const { data, channels } = image;
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    const r = data[p] / 255;
    const g = data[p + 1] / 255;
    const b = data[p + 2] / 255;
    L[j] = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 100;
  }
  return L;
}

export function rgbToLab(r: number, g: number, b: number) {
  const [L, a, bVal] = convert.rgb.lab([r, g, b]);
  return { L, a, b: bVal };
}

export function labToRgb(L: number, a: number, b: number) {
  const [r, g, bOut] = convert.lab.rgb([
    clamp(L, 0, 100),
    clamp(a, -128, 128),
    clamp(b, -128, 128),
  ]);
  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(bOut, 0, 255)),
  };
}

export interface SourceTextureMaps {
  /** Zero-mean L residual from source (high-pass, px blur) */
  lDetail: Float32Array;
  /** Normalized bright-zone weight 0–1 from source L */
  highlight: Float32Array;
  /** Normalized source a residual −1..1 */
  aResidual: Float32Array;
  /** Normalized source b residual −1..1 */
  bResidual: Float32Array;
}

export function buildSourceTextureMaps(
  source: RgbaImage,
  upholstery: Mask,
  detailBlurPx = 8,
): SourceTextureMaps {
  const { width, height } = source;
  const n = width * height;
  const L = buildLinearL(source);
  const blurred = boxBlur(L, width, height, detailBlurPx);

  const lDetail = new Float32Array(n);
  const highlight = new Float32Array(n);
  const aVals: number[] = [];
  const bVals: number[] = [];
  const aRaw = new Float32Array(n);
  const bRaw = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * source.channels;
    const lab = rgbToLab(source.data[p], source.data[p + 1], source.data[p + 2]);
    lDetail[j] = L[j] - blurred[j];
    aRaw[j] = lab.a;
    bRaw[j] = lab.b;
    aVals.push(lab.a);
    bVals.push(lab.b);
    const bright = clamp((L[j] - 58) / 34, 0, 1);
    highlight[j] = bright * (1 - 0.25 * bright);
  }

  let detailSum = 0;
  let detailCount = 0;
  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    detailSum += lDetail[j];
    detailCount++;
  }
  const detailMean = detailCount ? detailSum / detailCount : 0;
  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    lDetail[j] -= detailMean;
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
    aResidual[j] = (aRaw[j] - aMean) / aMax;
    bResidual[j] = (bRaw[j] - bMean) / bMax;
  }

  return { lDetail, highlight, aResidual, bResidual };
}

export function meanUpholsteryLab(
  image: RgbaImage,
  upholstery: Mask,
): { meanL: number; meanA: number; meanB: number; count: number } {
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let count = 0;
  const { channels } = image;
  for (let j = 0; j < upholstery.data.length; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(image.data[p], image.data[p + 1], image.data[p + 2]);
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
    count++;
  }
  return {
    meanL: count ? sumL / count : 0,
    meanA: count ? sumA / count : 0,
    meanB: count ? sumB / count : 0,
    count,
  };
}
