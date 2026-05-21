/**
 * Bali upholstery compose: source lowfreq + ref texture + chroma variation + seam protect.
 * Matte/contour: bali-matte.js (unchanged settings).
 */
import convert from 'color-convert';

const MASK_APPLY_THRESH = 128;

export const LOWFREQ_RADIUS_BASE = 16;
export const REF_MEDIUM_BLUR = 12;
export const REF_FINE_BLUR = 4;
export const REF_MEDIUM_TEXTURE_WEIGHT = 0.64;
export const REF_FINE_TEXTURE_WEIGHT = 0.36;
export const REF_TEXTURE_AMPLITUDE = 0.92;
export const SOURCE_DETAIL_MIX = 0.52;
export const REF_TEXTURE_MIX = 0.48;
export const DETAIL_GAIN = 1.11;
export const REF_DETAIL_STD_TARGET = 2.5;
export const CHROMA_SOURCE_KEEP = 0.06;
export const REFLECTANCE_L_AMP = 0.95;
export const CHROMA_A_AMP = 0.38;
export const CHROMA_B_AMP = 0.46;
export const LOWFREQ_CHROMA_A_AMP = 0.18;
export const LOWFREQ_CHROMA_B_AMP = 0.24;
export const LOWFREQ_CHROMA_BLUR_BASE = 34;
export const LOCAL_CONTRAST_RADIUS = 4;
export const LOCAL_CONTRAST_AMOUNT = 0.07;
export const TEXTURE_FULL_L = 66;
export const TEXTURE_MIN_L = 82;
export const TEXTURE_MIN_STRENGTH = 0.62;
export const CHROMA_TEXTURE_FULL_L = 72;
export const CHROMA_TEXTURE_MIN_L = 82;
export const CHROMA_TEXTURE_MIN_STRENGTH = 0.6;
export const HIGHLIGHT_TIER1_START = 74;
export const HIGHLIGHT_TIER1_RATIO = 0.48;
export const HIGHLIGHT_TIER2_START = 82;
export const HIGHLIGHT_TIER2_RATIO = 0.32;
export const SEAM_INFLUENCE_MAX = 0.54;
export const PERCENTILE_LO = 0.12;
export const PERCENTILE_HI = 0.88;

/** Highlight-based texture suppression (detail transfer). */
export function highlightDetailStrength(L) {
  if (L <= TEXTURE_FULL_L) return 1;
  if (L >= TEXTURE_MIN_L) return TEXTURE_MIN_STRENGTH;
  const t = (L - TEXTURE_FULL_L) / (TEXTURE_MIN_L - TEXTURE_FULL_L);
  return 1 - t * (1 - TEXTURE_MIN_STRENGTH);
}

/** Highlight-based chroma variation suppression. */
export function highlightChromaStrength(L) {
  if (L <= CHROMA_TEXTURE_FULL_L) return 1;
  if (L >= CHROMA_TEXTURE_MIN_L) return CHROMA_TEXTURE_MIN_STRENGTH;
  const t = (L - CHROMA_TEXTURE_FULL_L) / (CHROMA_TEXTURE_MIN_L - CHROMA_TEXTURE_FULL_L);
  return 1 - t * (1 - CHROMA_TEXTURE_MIN_STRENGTH);
}

/** Chroma variation weight: strongest L 58–70, taper highlights/shadows. */
export function materialChromaWeight(L) {
  if (L >= 58 && L <= 70) return 1;
  if (L > 70 && L <= 82) return 1 - ((L - 70) / 12) * 0.45;
  if (L > 82) return 0.55;
  if (L < 58 && L >= 42) return 0.65 + ((L - 42) / 16) * 0.35;
  if (L < 42) return 0.65;
  return 1;
}

/** Reflectance L modulation weight: strongest L 52–72. */
export function reflectanceLumaWeight(L) {
  if (L >= 52 && L <= 72) return 1;
  if (L > 72 && L <= 78) return 1 - ((L - 72) / 6) * 0.4;
  if (L > 78) return 0.6;
  if (L < 52 && L >= 40) return 0.6 + ((L - 40) / 12) * 0.4;
  if (L < 40) return 0.6;
  return 1;
}

export function getBaliComposeParams(width, height) {
  return {
    lowfreqRadius: scaleRadius(LOWFREQ_RADIUS_BASE, width, height),
    refMediumBlur: scaleRadius(REF_MEDIUM_BLUR, width, height),
    refFineBlur: scaleRadius(REF_FINE_BLUR, width, height),
    sourceDetailMix: SOURCE_DETAIL_MIX,
    refTextureMix: REF_TEXTURE_MIX,
    refTextureAmplitude: REF_TEXTURE_AMPLITUDE,
    refMediumWeight: REF_MEDIUM_TEXTURE_WEIGHT,
    refFineWeight: REF_FINE_TEXTURE_WEIGHT,
    detailGain: DETAIL_GAIN,
    reflectanceL: REFLECTANCE_L_AMP,
    chromaA: CHROMA_A_AMP,
    chromaB: CHROMA_B_AMP,
    lowfreqChroma: `a±${LOWFREQ_CHROMA_A_AMP} b±${LOWFREQ_CHROMA_B_AMP}`,
    textureHighlight: `full≤L${TEXTURE_FULL_L}, ${TEXTURE_MIN_STRENGTH * 100}%@L${TEXTURE_MIN_L}`,
    chromaHighlight: `full≤L${CHROMA_TEXTURE_FULL_L}, ${CHROMA_TEXTURE_MIN_STRENGTH * 100}%@L${CHROMA_TEXTURE_MIN_L}`,
    highlightTier1: `${HIGHLIGHT_TIER1_START}×${HIGHLIGHT_TIER1_RATIO}`,
    highlightTier2: `${HIGHLIGHT_TIER2_START}×${HIGHLIGHT_TIER2_RATIO}`,
    localContrast: `r${LOCAL_CONTRAST_RADIUS}×${LOCAL_CONTRAST_AMOUNT}`,
    seamInfluenceMax: SEAM_INFLUENCE_MAX,
    textureNorm: `${PERCENTILE_LO * 100}–${PERCENTILE_HI * 100} percentile soft clamp`,
  };
}

function rgbToLab(r, g, b) {
  const lab = convert.rgb.lab([r, g, b]);
  return { L: lab[0], a: lab[1], b: lab[2] };
}

function labToRgb(L, a, b) {
  const [r, g, bOut] = convert.lab.rgb([
    Math.max(0, Math.min(100, L)),
    Math.max(-128, Math.min(128, a)),
    Math.max(-128, Math.min(128, b)),
  ]);
  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(bOut))),
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function softClampNorm(v) {
  return v / (1 + Math.abs(v) * 0.4);
}

function boxBlurPass(src, dst, width, height, horizontal, radius) {
  const r = Math.max(1, Math.round(radius));
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

export function scaleRadius(base, width, height) {
  return Math.max(4, Math.round((base * Math.min(width, height)) / 600));
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

/** 12th–88th percentile scale with soft clamp (not hard clip). */
function normalizeMaskedPercentile(detail, mask, stdTarget = REF_DETAIL_STD_TARGET) {
  const vals = [];
  for (let j = 0; j < detail.length; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    vals.push(detail[j]);
  }
  if (!vals.length) return new Float32Array(detail.length);
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor(vals.length * PERCENTILE_LO)] ?? vals[0];
  const hi = vals[Math.floor(vals.length * PERCENTILE_HI)] ?? vals[vals.length - 1];
  const mid = (lo + hi) * 0.5;
  const span = Math.max(hi - lo, 0.5);
  const out = new Float32Array(detail.length);
  for (let j = 0; j < detail.length; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      out[j] = 0;
      continue;
    }
    const n = softClampNorm((detail[j] - mid) / span);
    out[j] = n * stdTarget;
  }
  return out;
}

function normalizeMaskedToAmplitude(detail, mask, amplitude) {
  const norm = normalizeMaskedPercentile(detail, mask, 1);
  const out = new Float32Array(detail.length);
  for (let j = 0; j < detail.length; j++) {
    out[j] = norm[j] * amplitude;
  }
  return out;
}

function buildSeamMap(sourceL, mask, width, height) {
  const n = width * height;
  const edge = new Float32Array(n);
  let maxE = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const c = sourceL[j];
      const lap = Math.abs(
        -4 * c +
          sourceL[j - 1] +
          sourceL[j + 1] +
          sourceL[j - width] +
          sourceL[j + width],
      );
      edge[j] = lap;
      if (lap > maxE) maxE = lap;
    }
  }
  const seamWeight = new Float32Array(n);
  const inv = maxE > 0.01 ? 1 / maxE : 0;
  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) seamWeight[j] = 0;
    else seamWeight[j] = clamp(edge[j] * inv * SEAM_INFLUENCE_MAX, 0, SEAM_INFLUENCE_MAX);
  }
  return seamWeight;
}

export function compressUpholsteryHighlights(L) {
  let out = L;
  if (out > HIGHLIGHT_TIER1_START) {
    out = HIGHLIGHT_TIER1_START + (out - HIGHLIGHT_TIER1_START) * HIGHLIGHT_TIER1_RATIO;
  }
  if (out > HIGHLIGHT_TIER2_START) {
    out = HIGHLIGHT_TIER2_START + (out - HIGHLIGHT_TIER2_START) * HIGHLIGHT_TIER2_RATIO;
  }
  return out;
}

function applyLocalContrastOnL(L, mask, width, height) {
  const r = LOCAL_CONTRAST_RADIUS;
  const blur = gaussianBlur(L, width, height, r);
  const out = new Float32Array(L.length);
  for (let j = 0; j < L.length; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      out[j] = L[j];
      continue;
    }
    const detail = L[j] - blur[j];
    out[j] = L[j] + detail * LOCAL_CONTRAST_AMOUNT;
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

  const seamWeight = buildSeamMap(src.L, mask, width, height);

  let refMediumNorm = new Float32Array(n);
  let refFineNorm = new Float32Array(n);
  let refReflectanceL = new Float32Array(n);
  let refChromaA = new Float32Array(n);
  let refChromaB = new Float32Array(n);
  let lowfreqDriftA = new Float32Array(n);
  let lowfreqDriftB = new Float32Array(n);
  let highlightTexWeight = new Float32Array(n);
  let highlightChromaWeight = new Float32Array(n);

  if (referenceImage && referenceImage.width === width && referenceImage.height === height) {
    const ref = buildLabL(referenceImage);
    const medR = scaleRadius(REF_MEDIUM_BLUR, width, height);
    const fineR = scaleRadius(REF_FINE_BLUR, width, height);
    const refMedBlur = gaussianBlur(ref.L, width, height, medR);
    const refFineBlur = gaussianBlur(ref.L, width, height, fineR);
    const refMedium = new Float32Array(n);
    const refFine = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      refMedium[j] = ref.L[j] - refMedBlur[j];
      refFine[j] = ref.L[j] - refFineBlur[j];
    }
    refMediumNorm = normalizeMaskedPercentile(refMedium, mask);
    refFineNorm = normalizeMaskedPercentile(refFine, mask);

    const textureBasis = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      textureBasis[j] =
        refMediumNorm[j] * REF_MEDIUM_TEXTURE_WEIGHT + refFineNorm[j] * REF_FINE_TEXTURE_WEIGHT;
      refReflectanceL[j] = textureBasis[j];
      refChromaA[j] = textureBasis[j] * CHROMA_A_AMP;
      refChromaB[j] =
        (refMediumNorm[j] * 0.4 + refFineNorm[j] * 0.6) * CHROMA_B_AMP;
    }

    const chromaLowR = scaleRadius(LOWFREQ_CHROMA_BLUR_BASE, width, height);
    const refABlur = gaussianBlur(ref.a, width, height, chromaLowR);
    const refBBlur = gaussianBlur(ref.b, width, height, chromaLowR);
    const driftA = new Float32Array(n);
    const driftB = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      driftA[j] = ref.a[j] - refABlur[j];
      driftB[j] = ref.b[j] - refBBlur[j];
    }
    lowfreqDriftA = normalizeMaskedToAmplitude(driftA, mask, LOWFREQ_CHROMA_A_AMP);
    lowfreqDriftB = normalizeMaskedToAmplitude(driftB, mask, LOWFREQ_CHROMA_B_AMP);
  }

  const refTexture = new Float32Array(n);
  const transferredDetailRaw = new Float32Array(n);
  const finalDetail = new Float32Array(n);
  const chromaVariationMap = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    const baseL = srcLow[j];
    highlightTexWeight[j] = highlightDetailStrength(baseL);
    highlightChromaWeight[j] = highlightChromaStrength(baseL);

    refTexture[j] =
      (refMediumNorm[j] * REF_MEDIUM_TEXTURE_WEIGHT + refFineNorm[j] * REF_FINE_TEXTURE_WEIGHT) *
      REF_TEXTURE_AMPLITUDE *
      highlightTexWeight[j];

    transferredDetailRaw[j] = srcDetail[j] * SOURCE_DETAIL_MIX + refTexture[j] * REF_TEXTURE_MIX;
    const sw = seamWeight[j];
    finalDetail[j] = transferredDetailRaw[j] * (1 - sw) + srcDetail[j] * sw;

    chromaVariationMap[j] =
      Math.abs(refChromaA[j]) + Math.abs(refChromaB[j]) + Math.abs(lowfreqDriftA[j]) + Math.abs(lowfreqDriftB[j]);
  }

  return {
    width,
    height,
    srcL: src.L,
    srcLow,
    srcA: src.a,
    srcB: src.b,
    srcDetail,
    refMediumNorm,
    refFineNorm,
    finalDetail,
    transferredDetailRaw,
    refTexture,
    seamWeight,
    refReflectanceL,
    refChromaA,
    refChromaB,
    lowfreqDriftA,
    lowfreqDriftB,
    chromaVariationMap,
    highlightTexWeight,
    highlightChromaWeight,
  };
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

function applyMaskedMeanLumaOffset(out, mask, width, height, channels, palette) {
  const midRgb = labToRgb(palette.midtone.L, palette.midtone.a, palette.midtone.b);
  const targetMean = rec709Lum(midRgb.r, midRgb.g, midRgb.b);
  let outSum = 0;
  let n = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    outSum += rec709Lum(out[p], out[p + 1], out[p + 2]);
    n++;
  }
  if (!n) return;
  const scale = targetMean / Math.max(outSum / n, 0.5);
  if (Math.abs(scale - 1) < 0.002) return;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    out[p] = clamp(Math.round(out[p] * scale), 0, 255);
    out[p + 1] = clamp(Math.round(out[p + 1] * scale), 0, 255);
    out[p + 2] = clamp(Math.round(out[p + 2] * scale), 0, 255);
  }
}

function fillVizGray(buf, j, channels, value) {
  const p = j * channels;
  const v = clamp(Math.round(value), 0, 255);
  buf[p] = v;
  buf[p + 1] = v;
  buf[p + 2] = v;
  if (channels === 4) buf[p + 3] = 255;
}

/**
 * @returns compose result + material debug viz buffers
 */
export function recolorBaliUpholstery(sourceImage, mask, palette, referenceImage, chromaFn) {
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.from(data);
  const fields = prepareBaliComposeFields(sourceImage, referenceImage, mask);
  const params = getBaliComposeParams(width, height);
  const srcDetailViz = Buffer.alloc(width * height * channels);
  const refMesoViz = Buffer.alloc(width * height * channels);
  const refMicroViz = Buffer.alloc(width * height * channels);
  const detailViz = Buffer.alloc(width * height * channels);
  const chromaViz = Buffer.alloc(width * height * channels);
  const lowfreqDriftViz = Buffer.alloc(width * height * channels);
  const highlightWeightViz = Buffer.alloc(width * height * channels);
  const meanSrcLow = meanMaskedL(fields.srcLow, mask);
  const lShift = palette.midtone.L - meanSrcLow;

  const finalLBuf = new Float32Array(width * height);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      for (const buf of [
        srcDetailViz,
        refMesoViz,
        refMicroViz,
        detailViz,
        chromaViz,
        lowfreqDriftViz,
        highlightWeightViz,
      ]) {
        fillVizGray(buf, j, channels, 0);
      }
      continue;
    }
    const preL = fields.srcLow[j] + lShift + fields.finalDetail[j] * DETAIL_GAIN;
    const reflW = reflectanceLumaWeight(preL);
    finalLBuf[j] = preL + fields.refReflectanceL[j] * REFLECTANCE_L_AMP * reflW;

    fillVizGray(srcDetailViz, j, channels, 128 + fields.srcDetail[j] * 5);
    fillVizGray(refMesoViz, j, channels, 128 + fields.refMediumNorm[j] * 10);
    fillVizGray(refMicroViz, j, channels, 128 + fields.refFineNorm[j] * 12);
    fillVizGray(detailViz, j, channels, 128 + fields.finalDetail[j] * 5);
    fillVizGray(chromaViz, j, channels, 128 + fields.chromaVariationMap[j] * 25);
    fillVizGray(
      lowfreqDriftViz,
      j,
      channels,
      128 + (fields.lowfreqDriftA[j] + fields.lowfreqDriftB[j]) * 40,
    );
    fillVizGray(highlightWeightViz, j, channels, fields.highlightTexWeight[j] * 255);
  }

  const Lcontrasted = applyLocalContrastOnL(finalLBuf, mask, width, height);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    const r = data[p];
    const g = data[p + 1];
    const bIn = data[p + 2];
    const chroma = chromaFn(r, g, bIn, j);
    const srcLab = rgbToLab(r, g, bIn);
    const Lwork = Lcontrasted[j];
    const finalL = compressUpholsteryHighlights(clamp(Lwork, 0, 100));

    const chromaW = materialChromaWeight(Lwork) * fields.highlightChromaWeight[j];
    const finalA =
      chroma.a * (1 - CHROMA_SOURCE_KEEP) +
      srcLab.a * CHROMA_SOURCE_KEEP +
      fields.refChromaA[j] * chromaW +
      fields.lowfreqDriftA[j] * chromaW;
    const finalB =
      chroma.b * (1 - CHROMA_SOURCE_KEEP) +
      srcLab.b * CHROMA_SOURCE_KEEP +
      fields.refChromaB[j] * chromaW +
      fields.lowfreqDriftB[j] * chromaW;

    const rgb = labToRgb(finalL, finalA, finalB);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = data[p + 3];
  }

  applyMaskedMeanLumaOffset(out, mask, width, height, channels, palette);

  return {
    out,
    srcDetailViz,
    refMesoViz,
    refMicroViz,
    detailViz,
    chromaViz,
    lowfreqDriftViz,
    highlightWeightViz,
    fields,
    params,
  };
}
