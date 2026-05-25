import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { clamp, labToRgb, rgbToLab } from '../phase5/labUtil.js';
import type { SourceStructureGates } from '../phase9/sourceStructure.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';
import {
  sampleDetailBilinear,
  sofaToSwatchUV,
  type SwatchDetailLayers,
} from './swatchDetailExtract.js';

export interface DetailTransferParams {
  /** Target mean |ΔL| vs 6A for auto-calibration */
  targetMeanDeltaL: number;
  /** Blend: 0 = direct L add only, 1 = soft-light only */
  softLightMix: number;
  chromaStrength: number;
  sampleScale: number;
}

/** Soft-light style L modulation — preserves base shading envelope. */
function softLightL(baseL: number, detail: number, amount: number): number {
  const d = clamp(detail * amount, -1.2, 1.2);
  const blend = 0.5 + 0.5 * d;
  const n = clamp(baseL / 100, 0.02, 0.98);
  let out: number;
  if (n < 0.5) out = 2 * n * blend;
  else out = 1 - 2 * (1 - n) * (1 - blend);
  return clamp(out * 100, 0, 100);
}

function applyWithStrength(
  base: RgbaImage,
  upholstery: Mask,
  layers: SwatchDetailLayers,
  gates: SourceStructureGates,
  weight: Float32Array,
  strength: number,
  params: DetailTransferParams,
): RgbaImage {
  void gates;
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;
  const pw = layers.width;
  const ph = layers.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      const w = weight[j];
      if (w <= 0.002) continue;

      const { u, v } = sofaToSwatchUV(x, y, params.sampleScale);
      const detail = sampleDetailBilinear(layers.combinedDetail, pw, ph, u, v);
      const ca = sampleDetailBilinear(layers.chromaA, pw, ph, u * 0.92, v * 0.92);
      const cb = sampleDetailBilinear(layers.chromaB, pw, ph, u * 0.92, v * 0.92);

      const p = j * channels;
      const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);
      const effective = w * strength;

      const softL = softLightL(lab.L, detail, effective * 0.55);
      const directL = lab.L + effective * detail * 2.8;
      const mix = params.softLightMix;
      const L = mix * softL + (1 - mix) * directL;

      let a = lab.a + w * params.chromaStrength * ca * 0.35;
      let b = lab.b + w * params.chromaStrength * cb * 0.35;

      const rgb = labToRgb(L, a, b);
      out[p] = rgb.r;
      out[p + 1] = rgb.g;
      out[p + 2] = rgb.b;
      if (channels === 4) out[p + 3] = base.data[p + 3];
    }
  }

  return { data: out, width, height, channels };
}

/** Binary-search strength to hit target mean |ΔL| vs 6A on upholstery. */
export function calibrateAndApplyDetailTransfer(
  base6a: RgbaImage,
  upholstery: Mask,
  layers: SwatchDetailLayers,
  gates: SourceStructureGates,
  weight: Float32Array,
  params: DetailTransferParams,
): { image: RgbaImage; strength: number; validation: ReturnType<typeof compareUpholsteryImages> } {
  let lo = 0.1;
  let hi = 24;
  let bestStrength = hi;
  let bestImage = applyWithStrength(base6a, upholstery, layers, gates, weight, hi, params);
  let bestCmp = compareUpholsteryImages(base6a, bestImage, upholstery);

  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const img = applyWithStrength(base6a, upholstery, layers, gates, weight, mid, params);
    const cmp = compareUpholsteryImages(base6a, img, upholstery);
    if (cmp.stats.meanAbsDeltaL < params.targetMeanDeltaL) lo = mid;
    else hi = mid;
    if (Math.abs(cmp.stats.meanAbsDeltaL - params.targetMeanDeltaL) < Math.abs(bestCmp.stats.meanAbsDeltaL - params.targetMeanDeltaL)) {
      bestStrength = mid;
      bestImage = img;
      bestCmp = cmp;
    }
  }

  const finalImg = applyWithStrength(base6a, upholstery, layers, gates, weight, (lo + hi) / 2, params);
  const finalCmp = compareUpholsteryImages(base6a, finalImg, upholstery);

  return {
    image: finalImg,
    strength: (lo + hi) / 2,
    validation: finalCmp,
  };
}

export function passesVisibleThreshold(cmp: ReturnType<typeof compareUpholsteryImages>): boolean {
  return cmp.stats.meanAbsDeltaL >= 1.0 && cmp.stats.ssimOnL < 0.99;
}
