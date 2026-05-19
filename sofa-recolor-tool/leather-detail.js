/**
 * Restore original sofa high-frequency L detail (grain/specular) after color transfer.
 */
import convert from 'color-convert';

const DETAIL_GAIN = 0.42;
const SPEC_GAIN = 0.18;
const DETAIL_CLAMP = 6;
const GAUSS_RADIUS = 6;
const MEAN_RADIUS = 12;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rgbToLabL(r, g, b) {
  return convert.rgb.lab([r, g, b])[0];
}

function makeGaussianKernel(radius) {
  const sigma = radius;
  const size = 2 * Math.ceil(3 * sigma) + 1;
  const half = Math.floor(size / 2);
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - half;
    const v = Math.exp((-x * x) / (2 * sigma * sigma));
    kernel[i] = v;
    sum += v;
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return { kernel, half, size };
}

function convolveSeparable(src, width, height, radius) {
  const { kernel, half, size } = makeGaussianKernel(radius);
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < size; k++) {
        const sx = clamp(x + k - half, 0, width - 1);
        sum += src[row + sx] * kernel[k];
      }
      tmp[row + x] = sum;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < size; k++) {
        const sy = clamp(y + k - half, 0, height - 1);
        sum += tmp[sy * width + x] * kernel[k];
      }
      out[y * width + x] = sum;
    }
  }

  return out;
}

/** LAB L per pixel from source sofa (original luminance structure). */
export function buildOriginalLPlane(sourceImage) {
  const { data, width, height, channels } = sourceImage;
  const L = new Float32Array(width * height);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    L[j] = rgbToLabL(data[p], data[p + 1], data[p + 2]);
  }
  return L;
}

/**
 * Precompute blurred fields for high-frequency detail + specular breakup.
 */
export function prepareOriginalLeatherDetail(sourceImage) {
  const { width, height } = sourceImage;
  const originalL = buildOriginalLPlane(sourceImage);
  const gaussianL = convolveSeparable(originalL, width, height, GAUSS_RADIUS);
  const localMeanL = convolveSeparable(originalL, width, height, MEAN_RADIUS);
  return { originalL, gaussianL, localMeanL, width, height };
}

/** Add clamped high-frequency L detail from original sofa only. */
export function applyLeatherDetailRestore(finalL, j, detail) {
  const oL = detail.originalL[j];
  const highFreq = oL - detail.gaussianL[j];
  const spec = Math.max(0, oL - detail.localMeanL[j]);
  let add = highFreq * DETAIL_GAIN + spec * SPEC_GAIN;
  add = clamp(add, -DETAIL_CLAMP, DETAIL_CLAMP);
  return finalL + add;
}
