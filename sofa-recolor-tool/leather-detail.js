/**
 * Restore original sofa photographic L structure (grain, edge, specular) after color transfer.
 * High-frequency only — no panel smoothing or luminance normalization.
 */
import convert from 'color-convert';

const DETAIL_GAUSS_RADIUS = 10;
const DETAIL_GAIN = 0.55;
const DETAIL_CLAMP = 8;
const EDGE_MEAN_RADIUS = 18;
const EDGE_THRESHOLD = 6;
const EDGE_GAIN = 0.12;
const SPEC_GAUSS_RADIUS = 14;
const SPEC_GAIN = 0.22;

const LIGHT_DETAIL_GAIN = 0.28;
const LIGHT_DETAIL_CLAMP = 4;
const LIGHT_SPEC_GAIN = 0.14;

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

export function buildOriginalLPlane(sourceImage) {
  const { data, width, height, channels } = sourceImage;
  const L = new Float32Array(width * height);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    L[j] = rgbToLabL(data[p], data[p + 1], data[p + 2]);
  }
  return L;
}

export function prepareOriginalLeatherDetail(sourceImage) {
  const { width, height } = sourceImage;
  const originalL = buildOriginalLPlane(sourceImage);
  const gaussianDetail = convolveSeparable(originalL, width, height, DETAIL_GAUSS_RADIUS);
  const localMeanEdge = convolveSeparable(originalL, width, height, EDGE_MEAN_RADIUS);
  const gaussianSpec = convolveSeparable(originalL, width, height, SPEC_GAUSS_RADIUS);
  return { originalL, gaussianDetail, localMeanEdge, gaussianSpec, width, height };
}

export function applyLeatherDetailRestore(finalL, j, detail, isLightLeather = false) {
  const oL = detail.originalL[j];

  if (isLightLeather) {
    let detailAdd = (oL - detail.gaussianDetail[j]) * LIGHT_DETAIL_GAIN;
    detailAdd = clamp(detailAdd, -LIGHT_DETAIL_CLAMP, LIGHT_DETAIL_CLAMP);
    let L = finalL + detailAdd;
    L += Math.max(0, oL - detail.gaussianSpec[j]) * LIGHT_SPEC_GAIN;
    return L;
  }

  let L = finalL;
  let detailAdd = (oL - detail.gaussianDetail[j]) * DETAIL_GAIN;
  detailAdd = clamp(detailAdd, -DETAIL_CLAMP, DETAIL_CLAMP);
  L += detailAdd;

  const edge = detail.localMeanEdge[j] - oL;
  if (edge > EDGE_THRESHOLD) {
    L -= edge * EDGE_GAIN;
  }

  L += Math.max(0, oL - detail.gaussianSpec[j]) * SPEC_GAIN;
  return L;
}
