/**
 * Transfer photographic realism from a reference render onto the current recolor.
 * Injects reference luminance detail (HF/MF/LF bands) — never full-image blend.
 */
import { MASK_APPLY_THRESH, labToRgb, rgbToLab } from './render-sofas.js';

const DEFAULT_REFERENCE = 'Bali-Silk-realism-reference.png';

/** Multi-scale L detail: reference minus current, scaled per band. */
const DETAIL_BANDS = [
  { radius: 1, gain: 0.92 },
  { radius: 3, gain: 0.78 },
  { radius: 8, gain: 0.28 },
];

const LOCAL_CONTRAST_GAIN = 0.22;
const LOCAL_CONTRAST_RADIUS = 5;
const LUMA_LOCK = true;

/** Debug: multiply reference detail injection (probe / trace only). */
const PROBE_DETAIL_MULTIPLIER = 3.5;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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

function highPassDetail(L, width, height, radius) {
  const blur = gaussianBlur(L, width, height, radius);
  const detail = new Float32Array(L.length);
  for (let j = 0; j < L.length; j++) detail[j] = L[j] - blur[j];
  return detail;
}

function buildLabL(image) {
  const { data, width, height, channels } = image;
  const n = width * height;
  const L = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    L[j] = rgbToLab(data[p], data[p + 1], data[p + 2]).L;
  }
  return L;
}

/** Soft mask weight: full strength in upholstery interior, fades near edge. */
function buildMaskWeight(mask, width, height) {
  const n = width * height;
  const soft = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    soft[j] = mask[j] >= MASK_APPLY_THRESH ? 1 : 0;
  }
  const blurred = gaussianBlur(soft, width, height, 4);
  const weight = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      weight[j] = 0;
      continue;
    }
    const t = clamp((blurred[j] - 0.12) / 0.78, 0, 1);
    weight[j] = t * t * (3 - 2 * t);
  }
  return weight;
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

function applyLocalContrastEnvelope(L, refL, mask, weight, width, height) {
  const blur = gaussianBlur(L, width, height, LOCAL_CONTRAST_RADIUS);
  const refBlur = gaussianBlur(refL, width, height, LOCAL_CONTRAST_RADIUS);
  const out = new Float32Array(L.length);
  for (let j = 0; j < L.length; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      out[j] = L[j];
      continue;
    }
    const local = L[j] - blur[j];
    const refLocal = refL[j] - refBlur[j];
    const curStd = Math.abs(local) + 0.35;
    const refStd = Math.abs(refLocal) + 0.35;
    const ratio = refStd / curStd;
    const boost = clamp((ratio - 1) * LOCAL_CONTRAST_GAIN, -0.35, 0.45);
    out[j] = L[j] + local * boost * weight[j];
  }
  return out;
}

/**
 * @param {Buffer} outBuffer — current Bali recolor (mutated in place)
 * @param {{ data: Buffer, width: number, height: number, channels: number }} currentImage
 * @param {{ data: Buffer, width: number, height: number, channels: number }} referenceImage
 * @param {Uint8Array} mask
 */
export function applyReferenceRealismTransfer(outBuffer, currentImage, referenceImage, mask, options = {}) {
  const skipLumaLock = Boolean(options.skipLumaLock);
  const skipMeanNormalize = Boolean(options.skipMeanNormalize);
  const detailMultiplier = options.detailMultiplier ?? 1;
  const skipLocalContrast = Boolean(options.skipLocalContrast);
  const { width, height, channels } = currentImage;
  if (
    referenceImage.width !== width ||
    referenceImage.height !== height ||
    referenceImage.channels !== channels
  ) {
    throw new Error(
      `Reference must match sofa dimensions ${width}x${height}, got ${referenceImage.width}x${referenceImage.height}`,
    );
  }

  const curL = buildLabL(currentImage);
  const refL = buildLabL(referenceImage);
  const weight = buildMaskWeight(mask, width, height);
  let targetL = new Float32Array(curL.length);
  for (let j = 0; j < curL.length; j++) targetL[j] = curL[j];

  for (const { radius, gain } of DETAIL_BANDS) {
    const refDetail = highPassDetail(refL, width, height, radius);
    const curDetail = highPassDetail(curL, width, height, radius);
    for (let j = 0; j < curL.length; j++) {
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const w = weight[j] * gain * detailMultiplier;
      targetL[j] += (refDetail[j] - curDetail[j]) * w;
    }
  }

  if (!skipLocalContrast) {
    targetL = applyLocalContrastEnvelope(targetL, refL, mask, weight, width, height);
  }

  let meanShift = 0;
  if (!skipMeanNormalize) {
    const meanBefore = meanMaskedL(curL, mask);
    const meanAfter = meanMaskedL(targetL, mask);
    meanShift = meanBefore - meanAfter;
    for (let j = 0; j < targetL.length; j++) {
      if (mask[j] < MASK_APPLY_THRESH) continue;
      targetL[j] = clamp(targetL[j] + meanShift, 0, 100);
    }
  }

  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    const srcR = currentImage.data[p];
    const srcG = currentImage.data[p + 1];
    const srcB = currentImage.data[p + 2];
    const srcLab = rgbToLab(srcR, srcG, srcB);
    const srcLum = rec709Lum(srcR, srcG, srcB);

    const { r, g, b } = labToRgb(targetL[j], srcLab.a, srcLab.b);

    let outR = r;
    let outG = g;
    let outB = b;
    if (!skipLumaLock && LUMA_LOCK) {
      const outLum = rec709Lum(outR, outG, outB);
      const ratio = srcLum / Math.max(outLum, 0.5);
      outR = clamp(Math.round(outR * ratio), 0, 255);
      outG = clamp(Math.round(outG * ratio), 0, 255);
      outB = clamp(Math.round(outB * ratio), 0, 255);
    }

    outBuffer[p] = outR;
    outBuffer[p + 1] = outG;
    outBuffer[p + 2] = outB;
  }

  return {
    bands: DETAIL_BANDS.map((b) => `L r${b.radius}×${b.gain}`).join(', '),
    localContrast: skipLocalContrast ? 0 : LOCAL_CONTRAST_GAIN,
    meanLShift: Math.round(meanShift * 100) / 100,
    lumaLock: !skipLumaLock && LUMA_LOCK,
    detailMultiplier,
  };
}

export { PROBE_DETAIL_MULTIPLIER };

export { DEFAULT_REFERENCE };
