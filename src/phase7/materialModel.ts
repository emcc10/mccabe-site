import type { Mask } from '../phase1/masks.js';
import { erode } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { boxBlur, buildLinearL, clamp, labToRgb, rgbToLab } from '../phase5/labUtil.js';

export interface MaterialModelParams {
  structureStrength: number;
  seamStrength: number;
  microStrength: number;
  highlightStrength: number;
}

export interface MaterialMaps {
  structure: Float32Array;
  seam: Float32Array;
  micro: Float32Array;
  highlight: Float32Array;
}

const STRUCTURE_BLUR_INNER = 22;
const STRUCTURE_BLUR_OUTER = 48;
const SEAM_BLUR_FINE = 2;
const SEAM_BLUR_MID = 12;
const MICRO_BLUR = 5;

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

/** Build structure / seam / micro maps from source (upholstery mask only). */
export function buildMaterialMaps(source: RgbaImage, upholstery: Mask): MaterialMaps {
  const { width, height } = source;
  const n = width * height;
  const L = buildLinearL(source);
  const blurInner = boxBlur(L, width, height, STRUCTURE_BLUR_INNER);
  const blurOuter = boxBlur(L, width, height, STRUCTURE_BLUR_OUTER);
  const blurFine = boxBlur(L, width, height, SEAM_BLUR_FINE);
  const blurMid = boxBlur(L, width, height, SEAM_BLUR_MID);
  const blurMicro = boxBlur(L, width, height, MICRO_BLUR);

  const structure = new Float32Array(n);
  const seam = new Float32Array(n);
  const micro = new Float32Array(n);
  const highlight = new Float32Array(n);

  const upholInterior = erode(upholstery, 3);
  const seamCandidates: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      structure[j] = blurInner[j] - blurOuter[j];

      const fineResidual = L[j] - blurFine[j];
      const midResidual = blurFine[j] - blurMid[j];
      const gradX = Math.abs(L[j + 1] - L[j - 1]);
      const gradY = Math.abs(L[(y + 1) * width + x] - L[(y - 1) * width + x]);
      const grad = gradX + gradY;

      const creaseSignal = Math.max(0, Math.abs(fineResidual) - 0.45 * Math.abs(midResidual));
      const gradSignal = Math.max(0, grad - 6);
      const raw = creaseSignal * 0.7 + gradSignal * 0.3;

      if (upholInterior.data[j] >= 128) seamCandidates.push(raw);
    }
  }

  const seamThreshold = percentileMasked(seamCandidates, 0.58);
  let seamMax = 1e-6;
  for (const v of seamCandidates) seamMax = Math.max(seamMax, Math.max(0, v - seamThreshold));

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    const y = (j / width) | 0;
    const x = j % width;
    if (y < 1 || y >= height - 1 || x < 1 || x >= width - 1) continue;

    const fineResidual = L[j] - blurFine[j];
    const midResidual = blurFine[j] - blurMid[j];
    const gradX = Math.abs(L[j + 1] - L[j - 1]);
    const gradY = Math.abs(L[(y + 1) * width + x] - L[(y - 1) * width + x]);
    const grad = gradX + gradY;
    const creaseSignal = Math.max(0, Math.abs(fineResidual) - 0.45 * Math.abs(midResidual));
    const gradSignal = Math.max(0, grad - 6);
    const raw = creaseSignal * 0.7 + gradSignal * 0.3;

    if (upholInterior.data[j] >= 128 && raw > seamThreshold) {
      seam[j] = (raw - seamThreshold) / seamMax;
    }

    micro[j] = (L[j] - blurInner[j]) - fineResidual * 0.35;

    const bright = clamp((L[j] - 60) / 32, 0, 1);
    highlight[j] = bright * (1 - 0.3 * bright);
  }

  zeroMeanOverUpholstery(structure, upholstery);
  zeroMeanOverUpholstery(micro, upholstery);

  return { structure, seam, micro, highlight };
}

/**
 * Phase 7 material model: structure → selective seams → micro variation → soft highlight.
 * Operates on upholstery mask only; base color from 4B-v3 + 6A unchanged elsewhere.
 */
export function applyMaterialModel(
  base: RgbaImage,
  upholstery: Mask,
  maps: MaterialMaps,
  params: MaterialModelParams,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);

    let L = lab.L;
    L += params.structureStrength * maps.structure[j];
    L += params.seamStrength * maps.seam[j];
    L += params.microStrength * maps.micro[j];

    const hi = maps.highlight[j];
    L += params.highlightStrength * 5.5 * hi * (1 - 0.4 * hi);

    const rgb = labToRgb(L, lab.a, lab.b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = base.data[p + 3];
  }

  return { data: out, width, height, channels };
}

export function materialMapToPreviewBuffer(
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
