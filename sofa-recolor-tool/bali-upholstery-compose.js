/**
 * Bali upholstery compose: source lowfreq + ref texture + seam protect + tight silhouette.
 */
import convert from 'color-convert';

const MASK_APPLY_THRESH = 128;

export const LOWFREQ_RADIUS_BASE = 16;
export const REF_MEDIUM_BLUR = 12;
export const REF_FINE_BLUR = 4;
export const REF_MEDIUM_TEXTURE_WEIGHT = 0.65;
export const REF_FINE_TEXTURE_WEIGHT = 0.35;
export const SOURCE_DETAIL_MIX = 0.52;
export const REF_TEXTURE_MIX = 0.48;
/** Measured source L fine band (sofa.png only) — photographic pore breakup. */
export const SOURCE_FINE_DETAIL_GAIN = 0.32;
export const DETAIL_GAIN = 1.15;
export const REF_DETAIL_STD_TARGET = 2.5;
export const CHROMA_SOURCE_KEEP = 0.06;
export const SPATIAL_L_AMP = 1.8;
export const SPATIAL_AB_AMP = 0.5;
export const LOCAL_CONTRAST_RADIUS = 6;
export const LOCAL_CONTRAST_AMOUNT = 0.12;
export const HIGHLIGHT_TIER1_START = 74;
export const HIGHLIGHT_TIER1_RATIO = 0.48;
export const HIGHLIGHT_TIER2_START = 82;
export const HIGHLIGHT_TIER2_RATIO = 0.32;
export const SEAM_INFLUENCE_MAX = 0.65;
export const CONTOUR_FEATHER_PX = 1.0;
export const EDGE_UNSHARP_RADIUS = 0.8;
export const EDGE_UNSHARP_AMOUNT = 0.52;
export const EXPORT_BG = { r: 255, g: 255, b: 255 };

export function getBaliComposeParams(width, height) {
  return {
    lowfreqRadius: scaleRadius(LOWFREQ_RADIUS_BASE, width, height),
    refMediumBlur: scaleRadius(REF_MEDIUM_BLUR, width, height),
    refFineBlur: scaleRadius(REF_FINE_BLUR, width, height),
    sourceDetailMix: SOURCE_DETAIL_MIX,
    refTextureMix: REF_TEXTURE_MIX,
    refMediumWeight: REF_MEDIUM_TEXTURE_WEIGHT,
    refFineWeight: REF_FINE_TEXTURE_WEIGHT,
    detailGain: DETAIL_GAIN,
    sourceFineDetailGain: SOURCE_FINE_DETAIL_GAIN,
    highlightTier1: `${HIGHLIGHT_TIER1_START}×${HIGHLIGHT_TIER1_RATIO}`,
    highlightTier2: `${HIGHLIGHT_TIER2_START}×${HIGHLIGHT_TIER2_RATIO}`,
    localContrast: `r${LOCAL_CONTRAST_RADIUS}×${LOCAL_CONTRAST_AMOUNT}`,
    seamInfluenceMax: SEAM_INFLUENCE_MAX,
    contourFeatherPx: CONTOUR_FEATHER_PX,
    edgeUnsharp: `r${EDGE_UNSHARP_RADIUS}×${EDGE_UNSHARP_AMOUNT}`,
    spatialL: SPATIAL_L_AMP,
    spatialAB: SPATIAL_AB_AMP,
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

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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

/** Inward distance from silhouette (background-adjacent edge = 0). */
function buildInwardDistance(mask, width, height) {
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
      for (const k of [j - 1, j + 1, j - width, j + width]) {
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
  return dist;
}

/**
 * interior = solid mask; contourAlpha = tight 1px feather on outer silhouette only.
 */
export function buildBaliMasks(mask, width, height, contourFeatherPx = CONTOUR_FEATHER_PX) {
  const n = width * height;
  const distIn = buildInwardDistance(mask, width, height);
  const interiorMask = new Uint8Array(n);
  const contourAlpha = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      interiorMask[j] = 0;
      contourAlpha[j] = 0;
      continue;
    }
    interiorMask[j] = 255;
    if (distIn[j] >= contourFeatherPx) contourAlpha[j] = 1;
    else contourAlpha[j] = clamp(distIn[j] / contourFeatherPx, 0, 1);
  }
  return { interiorMask, contourAlpha, distIn };
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
    sum += detail[j];
    sumSq += detail[j] * detail[j];
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

/** Source L edge map for seam protection (Laplacian magnitude). */
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
  const srcFineBlur = gaussianBlur(src.L, width, height, scaleRadius(1, width, height));
  const srcFineDetail = new Float32Array(n);
  for (let j = 0; j < n; j++) srcFineDetail[j] = src.L[j] - srcFineBlur[j];
  for (let j = 0; j < n; j++) srcDetail[j] = src.L[j] - srcLow[j];

  const seamWeight = buildSeamMap(src.L, mask, width, height);
  const masks = buildBaliMasks(mask, width, height);

  let refMediumNorm = new Float32Array(n);
  let refFineNorm = new Float32Array(n);
  let refSpatialL = new Float32Array(n);
  let refSpatialA = new Float32Array(n);
  let refSpatialB = new Float32Array(n);

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
    refMediumNorm = normalizeMaskedDetail(refMedium, mask);
    refFineNorm = normalizeMaskedDetail(refFine, mask);
    refSpatialL = normalizeMaskedDetail(ref.L, mask, SPATIAL_L_AMP);
    refSpatialA = normalizeMaskedDetail(ref.a, mask, SPATIAL_AB_AMP);
    refSpatialB = normalizeMaskedDetail(ref.b, mask, SPATIAL_AB_AMP);
  }

  const refTexture = new Float32Array(n);
  const transferredDetailRaw = new Float32Array(n);
  const finalDetail = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    refTexture[j] =
      refMediumNorm[j] * REF_MEDIUM_TEXTURE_WEIGHT + refFineNorm[j] * REF_FINE_TEXTURE_WEIGHT;
    transferredDetailRaw[j] =
      srcDetail[j] * SOURCE_DETAIL_MIX +
      refTexture[j] * REF_TEXTURE_MIX +
      srcFineDetail[j] * SOURCE_FINE_DETAIL_GAIN;
    const sw = seamWeight[j];
    finalDetail[j] =
      transferredDetailRaw[j] * (1 - sw) + srcDetail[j] * sw;
  }

  return {
    width,
    height,
    srcL: src.L,
    srcLow,
    srcA: src.a,
    srcB: src.b,
    srcDetail,
    srcFineDetail,
    finalDetail,
    transferredDetailRaw,
    seamWeight,
    contourAlpha: masks.contourAlpha,
    distIn: masks.distIn,
    refSpatialL,
    refSpatialA,
    refSpatialB,
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

function touchesBackground(mask, j, width, height) {
  const x = j % width;
  const y = (j / width) | 0;
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return true;
  if (mask[j - 1] < MASK_APPLY_THRESH) return true;
  if (mask[j + 1] < MASK_APPLY_THRESH) return true;
  if (mask[j - width] < MASK_APPLY_THRESH) return true;
  if (mask[j + width] < MASK_APPLY_THRESH) return true;
  return false;
}

/**
 * After finalize: crisp silhouette vs white bg (fixes leg/arm cutout fringe).
 * Unsharp only in transition band — not whole image.
 */
export function applySilhouetteEdgeCrisp(
  out,
  mask,
  contourAlpha,
  distIn,
  width,
  height,
  channels,
  bg = EXPORT_BG,
) {
  const r = Math.max(1, Math.round(EDGE_UNSHARP_RADIUS));
  const amount = EDGE_UNSHARP_AMOUNT;
  const feather = CONTOUR_FEATHER_PX;
  const n = width * height;
  const Y = new Float32Array(n);
  const edgeBand = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    Y[j] = rec709Lum(out[p], out[p + 1], out[p + 2]);
    const onContour = distIn[j] < feather || touchesBackground(mask, j, width, height);
    if (onContour) edgeBand[j] = 1;
  }

  const blurY = gaussianBlur(Y, width, height, r);

  for (let j = 0; j < n; j++) {
    if (edgeBand[j] <= 0) continue;
    const p = j * channels;
    const y = Y[j];
    const sharpY = y + (y - blurY[j]) * amount;
    const scale = y > 0.5 ? sharpY / y : 1;
    let nr = clamp(Math.round(out[p] * scale), 0, 255);
    let ng = clamp(Math.round(out[p + 1] * scale), 0, 255);
    let nb = clamp(Math.round(out[p + 2] * scale), 0, 255);
    const alpha = clamp(contourAlpha[j], 0, 1);
    out[p] = clamp(Math.round(nr * alpha + bg.r * (1 - alpha)), 0, 255);
    out[p + 1] = clamp(Math.round(ng * alpha + bg.g * (1 - alpha)), 0, 255);
    out[p + 2] = clamp(Math.round(nb * alpha + bg.b * (1 - alpha)), 0, 255);
  }
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
 * @returns {{ out, detailViz, contourViz, seamViz, fields, params }}
 */
export function recolorBaliUpholstery(sourceImage, mask, palette, referenceImage, chromaFn) {
  const { data, width, height, channels } = sourceImage;
  const out = Buffer.from(data);
  const fields = prepareBaliComposeFields(sourceImage, referenceImage, mask);
  const params = getBaliComposeParams(width, height);
  const detailViz = Buffer.alloc(width * height * channels);
  const contourViz = Buffer.alloc(width * height * channels);
  const seamViz = Buffer.alloc(width * height * channels);
  const meanSrcLow = meanMaskedL(fields.srcLow, mask);
  const lShift = palette.midtone.L - meanSrcLow;

  const finalLBuf = new Float32Array(width * height);

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      fillVizGray(detailViz, j, channels, 0);
      fillVizGray(contourViz, j, channels, 0);
      fillVizGray(seamViz, j, channels, 0);
      continue;
    }
    finalLBuf[j] = fields.srcLow[j] + lShift + fields.finalDetail[j] * DETAIL_GAIN;
    finalLBuf[j] += fields.refSpatialL[j];
    fillVizGray(detailViz, j, channels, 128 + fields.finalDetail[j] * 5);
    fillVizGray(contourViz, j, channels, fields.contourAlpha[j] * 255);
    fillVizGray(seamViz, j, channels, 128 + fields.seamWeight[j] * 120);
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
    const finalL = compressUpholsteryHighlights(clamp(Lcontrasted[j], 0, 100));
    const finalA =
      chroma.a * (1 - CHROMA_SOURCE_KEEP) +
      srcLab.a * CHROMA_SOURCE_KEEP +
      fields.refSpatialA[j];
    const finalB =
      chroma.b * (1 - CHROMA_SOURCE_KEEP) +
      srcLab.b * CHROMA_SOURCE_KEEP +
      fields.refSpatialB[j];
    const rgb = labToRgb(finalL, finalA, finalB);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = data[p + 3];
  }

  applyMaskedMeanLumaOffset(out, mask, width, height, channels, palette);

  return { out, detailViz, contourViz, seamViz, fields, params };
}
