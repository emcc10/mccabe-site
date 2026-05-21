/**
 * Measured Rec.709 luminance residuals from original sofa.png (preservation, not synthesis).
 */
import { MASK_APPLY_THRESH } from './render-sofas.js';

const HF_BLUR_RADIUS = 1;
const MF_BLUR_LO = 1;
const MF_BLUR_HI = 5;

/** TEMPORARY realism push — source photo only. */
export const PHOTO_HF_GAIN = 0.9;
export const PHOTO_MF_GAIN = 0.45;
export const INTERIOR_MIN_EDGE_DIST = 6;
/** Soft cap on combined injection (luma units). */
export const PHOTO_RESIDUAL_CLAMP = 8;

/** LF specular sheen: smooth highlight lobe (blur_in − blur_out), interior + upper-luma only. */
export const SPECULAR_BLUR_INNER = 4;
export const SPECULAR_BLUR_OUTER = 14;
/** Fraction of smooth LF highlight lobe removed (not HF/MF). */
export const SPECULAR_SHEEN_ATTEN = 0.3;
export const SPECULAR_HIGHLIGHT_U0 = 0.5;
export const SPECULAR_HIGHLIGHT_U1 = 0.86;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function rec709Lum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function boxBlurPass(src, dst, width, height, horizontal, radius) {
  const r = radius;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      if (horizontal) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = clamp(x + dx, 0, width - 1);
          sum += src[y * width + xx];
        }
        dst[y * width + x] = sum / (r * 2 + 1);
      } else {
        for (let dy = -r; dy <= r; dy++) {
          const yy = clamp(y + dy, 0, height - 1);
          sum += src[yy * width + x];
        }
        dst[y * width + x] = sum / (r * 2 + 1);
      }
    }
  }
}

function gaussianBlur(src, width, height, radius) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  boxBlurPass(src, tmp, width, height, true, radius);
  boxBlurPass(tmp, out, width, height, false, radius);
  return out;
}

function highPass(src, width, height, radius) {
  const blur = gaussianBlur(src, width, height, radius);
  const out = new Float32Array(src.length);
  for (let j = 0; j < src.length; j++) out[j] = src[j] - blur[j];
  return out;
}

/** Inward distance from mask edge (upholstery pixels only). */
export function buildMaskInteriorWeight(mask, width, height, minDist = INTERIOR_MIN_EDGE_DIST) {
  const n = width * height;
  const dist = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      dist[j] = 0;
      continue;
    }
    const x = j % width;
    const y = (j / width) | 0;
    let onEdge = false;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) onEdge = true;
    else {
      const nb = [
        j - 1,
        j + 1,
        j - width,
        j + width,
      ];
      for (const k of nb) {
        if (mask[k] < MASK_APPLY_THRESH) onEdge = true;
      }
    }
    dist[j] = onEdge ? 0 : 1e6;
  }

  for (let pass = 0; pass < width + height; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const j = y * width + x;
        if (mask[j] < MASK_APPLY_THRESH || dist[j] === 0) continue;
        let best = dist[j];
        if (x > 0 && mask[j - 1] >= MASK_APPLY_THRESH) best = Math.min(best, dist[j - 1] + 1);
        if (x < width - 1 && mask[j + 1] >= MASK_APPLY_THRESH) best = Math.min(best, dist[j + 1] + 1);
        if (y > 0 && mask[j - width] >= MASK_APPLY_THRESH) best = Math.min(best, dist[j - width] + 1);
        if (y < height - 1 && mask[j + width] >= MASK_APPLY_THRESH) {
          best = Math.min(best, dist[j + width] + 1);
        }
        dist[j] = best;
      }
    }
  }

  const weight = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) weight[j] = 0;
    else weight[j] = dist[j] > minDist ? 1 : 0;
  }
  return weight;
}

/**
 * HF/MF from source Rec.709 luma; interior weight from mask (>6px from edge).
 */
export function prepareSourceLGrain(sourceImage, mask) {
  const { data, width, height, channels } = sourceImage;
  const n = width * height;
  const Y = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    Y[j] = rec709Lum(data[p], data[p + 1], data[p + 2]);
  }
  const blur1 = gaussianBlur(Y, width, height, MF_BLUR_LO);
  const blur5 = gaussianBlur(Y, width, height, MF_BLUR_HI);
  const sourceHf = highPass(Y, width, height, HF_BLUR_RADIUS);
  const sourceMf = new Float32Array(n);
  for (let j = 0; j < n; j++) sourceMf[j] = blur1[j] - blur5[j];
  const interiorWeight = buildMaskInteriorWeight(mask, width, height, INTERIOR_MIN_EDGE_DIST);
  return { width, height, sourceHf, sourceMf, interiorWeight };
}

/**
 * Smooth LF positive highlight field from source photo (broad specular rolloff).
 * @param {{ lo: number, span: number }} lumRange — masked Rec.709 luma range on upholstery
 */
export function prepareSpecularSheenMap(sourceImage, mask, lumRange) {
  const { data, width, height, channels } = sourceImage;
  const n = width * height;
  const Y = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    Y[j] = rec709Lum(data[p], data[p + 1], data[p + 2]);
  }
  const blurInner = gaussianBlur(Y, width, height, SPECULAR_BLUR_INNER);
  const blurOuter = gaussianBlur(Y, width, height, SPECULAR_BLUR_OUTER);
  const smoothSpec = new Float32Array(n);
  const hiWeight = new Float32Array(n);
  const interiorWeight = buildMaskInteriorWeight(mask, width, height, INTERIOR_MIN_EDGE_DIST);
  const lo = lumRange.lo;
  const span = Math.max(lumRange.span, 1);
  for (let j = 0; j < n; j++) {
    smoothSpec[j] = Math.max(0, blurInner[j] - blurOuter[j]);
    const u = clamp((Y[j] - lo) / span, 0, 1);
    const hi = smoothstep(SPECULAR_HIGHLIGHT_U0, SPECULAR_HIGHLIGHT_U1, u);
    hiWeight[j] = interiorWeight[j] * hi;
  }
  return { smoothSpec, hiWeight };
}

function softClampResidual(delta) {
  return clamp(delta, -PHOTO_RESIDUAL_CLAMP, PHOTO_RESIDUAL_CLAMP);
}

/** Apply measured Y residual AFTER chroma + luma lock (avoids ratio canceling detail). */
export function applySourceYResidualToRgb(r, g, b, j, grain) {
  if (!grain) return { r, g, b };
  const y = rec709Lum(r, g, b);
  if (y < 0.5) return { r, g, b };
  const w = grain.interiorWeight[j];
  if (w <= 0) return { r, g, b };
  const delta = softClampResidual(
    (grain.sourceHf[j] * PHOTO_HF_GAIN + grain.sourceMf[j] * PHOTO_MF_GAIN) * w,
  );
  const yNew = clamp(y + delta, 0, 255);
  const scale = yNew / y;
  return attenuateSpecularSheenRgb(
    {
      r: clamp(Math.round(r * scale), 0, 255),
      g: clamp(Math.round(g * scale), 0, 255),
      b: clamp(Math.round(b * scale), 0, 255),
    },
    j,
    grain,
  );
}

/**
 * Pull down broad smooth highlight lobes (satin/CGI sheen) without touching HF/MF grain.
 */
export function attenuateSpecularSheenRgb(rgb, j, grain) {
  if (!grain?.smoothSpec || !grain?.hiWeight) return rgb;
  const w = grain.hiWeight[j];
  if (w <= 0) return rgb;
  let { r, g, b } = rgb;
  const y = rec709Lum(r, g, b);
  if (y < 0.5) return rgb;
  const cut = grain.smoothSpec[j] * SPECULAR_SHEEN_ATTEN * w;
  if (cut < 0.02) return rgb;
  const yNew = clamp(y - cut, 0, 255);
  const scale = yNew / y;
  return {
    r: clamp(Math.round(r * scale), 0, 255),
    g: clamp(Math.round(g * scale), 0, 255),
    b: clamp(Math.round(b * scale), 0, 255),
  };
}

/** @deprecated LAB-stage injection — use applySourceYResidualToRgb after luma lock. */
export function applySourceLGrain(finalL, j, grain) {
  const w = grain.interiorWeight?.[j] ?? 0;
  const delta = softClampResidual(
    (grain.sourceHf[j] * PHOTO_HF_GAIN + grain.sourceMf[j] * PHOTO_MF_GAIN) * w,
  );
  return finalL + delta;
}

/** Stress/probe: LF band from source Rec.709 luma (debug only). */
export function prepareSourceLLfBand(sourceImage, lfRadius = 6) {
  const { data, width, height, channels } = sourceImage;
  const n = width * height;
  const Y = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    Y[j] = rec709Lum(data[p], data[p + 1], data[p + 2]);
  }
  return highPass(Y, width, height, lfRadius);
}
