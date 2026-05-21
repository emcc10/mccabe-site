/**
 * Bali upholstery: lowfreq source lighting + transferred leather detail (no per-pixel luma lock).
 */
import { MASK_APPLY_THRESH, labToRgb, rgbToLab } from './render-sofas.js';

/** Blur radius for source/catalog lighting shape (px, scaled to ~600px height). */
export const LOWFREQ_RADIUS_BASE = 16;
/** Reference detail extraction blur. */
export const REF_DETAIL_BLUR = 8;
export const REF_TEXTURE_BLUR = 2;
export const SOURCE_DETAIL_MIX = 0.65;
export const REF_DETAIL_MIX = 0.35;
/** Mid detail boost before recomposition (local contrast). */
export const DETAIL_GAIN = 1.12;
/** Normalized ref micro-texture strength. */
export const TEXTURE_STRENGTH = 0.11;
export const REF_DETAIL_STD_TARGET = 2.5;
/** Subtle source a/b retained for natural color variation. */
export const CHROMA_SOURCE_KEEP = 0.06;
export const HIGHLIGHT_START = 75;
export const HIGHLIGHT_COMPRESS = 0.55;
/** Feather only at silhouette — interior stays full strength. */
export const SILHOUETTE_FEATHER_PX = 3;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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

export function gaussianBlur(src, width, height, radius) {
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  boxBlurPass(src, tmp, width, height, true, r);
  boxBlurPass(tmp, out, width, height, false, r);
  return out;
}

function scaleRadius(base, width, height) {
  return Math.max(4, Math.round((base * Math.min(width, height)) / 600));
}

/** Silhouette feather only — full weight in upholstery interior. */
export function buildSilhouetteFeatherWeight(mask, width, height, featherPx = SILHOUETTE_FEATHER_PX) {
  const n = width * height;
  const dist = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      dist[j] = 0;
      continue;
    }
    const x = j % width;
    const y = (j / width) | 0;
    let onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (!onEdge) {
      const nb = [j - 1, j + 1, j - width, j + width];
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
    else weight[j] = dist[j] >= featherPx ? 1 : smoothstep(0, featherPx, dist[j]);
  }
  return weight;
}

function buildLabL(image) {
  const { data, width, height, channels } = image;
  const n = width * height;
  const L = new Float32Array(n);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    L[j] = lab.L;
    a[j] = lab.a;
    b[j] = lab.b;
  }
  return { L, a, b, width, height };
}

function normalizeMaskedDetail(detail, mask, stdTarget = REF_DETAIL_STD_TARGET) {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let j = 0; j < detail.length; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const v = detail[j];
    sum += v;
    sumSq += v * v;
    n++;
  }
  if (!n) return new Float32Array(detail.length);
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const std = Math.max(Math.sqrt(Math.max(variance, 0)), 0.25);
  const scale = stdTarget / std;
  const out = new Float32Array(detail.length);
  for (let j = 0; j < detail.length; j++) {
    if (mask[j] < MASK_APPLY_THRESH) out[j] = 0;
    else out[j] = (detail[j] - mean) * scale;
  }
  return out;
}

export function prepareBaliComposeFields(sourceImage, referenceImage, mask) {
  const { width, height } = sourceImage;
  const n = width * height;
  const src = buildLabL(sourceImage);
  const lowR = scaleRadius(LOWFREQ_RADIUS_BASE, width, height);
  const srcLow = gaussianBlur(src.L, width, height, lowR);
  const srcDetail = new Float32Array(n);
  for (let j = 0; j < n; j++) srcDetail[j] = src.L[j] - srcLow[j];

  let refNormDetail = new Float32Array(n);
  let refTexture = new Float32Array(n);
  if (referenceImage && referenceImage.width === width && referenceImage.height === height) {
    const ref = buildLabL(referenceImage);
    const refLow8 = gaussianBlur(ref.L, width, height, REF_DETAIL_BLUR);
    const refDetail = new Float32Array(n);
    for (let j = 0; j < n; j++) refDetail[j] = ref.L[j] - refLow8[j];
    refNormDetail = normalizeMaskedDetail(refDetail, mask);
    const refTexBlur = gaussianBlur(ref.L, width, height, REF_TEXTURE_BLUR);
    for (let j = 0; j < n; j++) refTexture[j] = ref.L[j] - refTexBlur[j];
    refTexture = normalizeMaskedDetail(refTexture, mask, REF_DETAIL_STD_TARGET * 0.85);
  }

  const transferredDetail = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    transferredDetail[j] =
      srcDetail[j] * SOURCE_DETAIL_MIX + refNormDetail[j] * REF_DETAIL_MIX;
  }

  const featherW = buildSilhouetteFeatherWeight(mask, width, height);
  return {
    width,
    height,
    srcL: src.L,
    srcLow,
    srcA: src.a,
    srcB: src.b,
    transferredDetail,
    refTexture,
    featherW,
  };
}

export function compressUpholsteryHighlights(L) {
  if (L <= HIGHLIGHT_START) return L;
  return HIGHLIGHT_START + (L - HIGHLIGHT_START) * HIGHLIGHT_COMPRESS;
}

/**
 * @returns {{ out: Buffer, detailViz: Buffer }}
 */
export function recolorBaliUpholstery(sourceImage, mask, palette, referenceImage, chromaFn) {
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.from(data);
  const fields = prepareBaliComposeFields(sourceImage, referenceImage, mask);
  const detailViz = Buffer.alloc(width * height * channels);
  const meanPhotoL = meanMaskedL(fields.srcL, mask);
  const anchorL = palette.midtone.L;
  const lShift = anchorL - meanPhotoL;

  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    if (mask[j] < MASK_APPLY_THRESH) {
      if (channels === 4) out[p + 3] = data[p + 3];
      detailViz[p] = data[p];
      detailViz[p + 1] = data[p + 1];
      detailViz[p + 2] = data[p + 2];
      if (channels === 4) detailViz[p + 3] = 255;
      continue;
    }

    const r = data[p];
    const g = data[p + 1];
    const bIn = data[p + 2];
    const chroma = chromaFn(r, g, bIn, j);
    const srcLab = rgbToLab(r, g, bIn);

    const w = fields.featherW[j];
    let detail =
      fields.transferredDetail[j] * DETAIL_GAIN +
      fields.refTexture[j] * TEXTURE_STRENGTH;
    detail *= w;

    let finalL = fields.srcLow[j] + lShift + detail;
    finalL = compressUpholsteryHighlights(finalL);
    finalL = clamp(finalL, 0, 100);

    const finalA = chroma.a * (1 - CHROMA_SOURCE_KEEP) + srcLab.a * CHROMA_SOURCE_KEEP;
    const finalB = chroma.b * (1 - CHROMA_SOURCE_KEEP) + srcLab.b * CHROMA_SOURCE_KEEP;
    const { r: outR, g: outG, b: outB } = labToRgb(finalL, finalA, finalB);

    out[p] = outR;
    out[p + 1] = outG;
    out[p + 2] = outB;
    if (channels === 4) out[p + 3] = data[p + 3];

    const viz = clamp(Math.round(128 + detail * 5), 0, 255);
    detailViz[p] = viz;
    detailViz[p + 1] = viz;
    detailViz[p + 2] = viz;
    if (channels === 4) detailViz[p + 3] = 255;
  }

  applyMaskedMeanLumaOffset(out, mask, width, height, channels, sourceImage, palette);
  return { out, detailViz, fields };
}

function meanMaskedL(L, mask) {
  let sum = 0;
  let n = 0;
  for (let j = 0; j < L.length; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    sum += L[j];
    n++;
  }
  return n ? sum / n : 0;
}

function rec709Lum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Global mean luma nudge only — preserves per-pixel contrast ratios. */
function applyMaskedMeanLumaOffset(out, mask, width, height, channels, sourceImage, palette) {
  const anchorL = palette.midtone.L;
  const midRgb = labToRgb(anchorL, palette.midtone.a, palette.midtone.b);
  const targetMean = rec709Lum(midRgb.r, midRgb.g, midRgb.b);

  let srcSum = 0;
  let outSum = 0;
  let n = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    srcSum += rec709Lum(sourceImage.data[p], sourceImage.data[p + 1], sourceImage.data[p + 2]);
    outSum += rec709Lum(out[p], out[p + 1], out[p + 2]);
    n++;
  }
  if (!n) return;
  const srcMean = srcSum / n;
  const scale = (srcMean + (targetMean - srcMean) * 0.35) / Math.max(outSum / n, 0.5);
  if (Math.abs(scale - 1) < 0.002) return;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    out[p] = clamp(Math.round(out[p] * scale), 0, 255);
    out[p + 1] = clamp(Math.round(out[p + 1] * scale), 0, 255);
    out[p + 2] = clamp(Math.round(out[p + 2] * scale), 0, 255);
  }
}
