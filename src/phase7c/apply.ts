import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { labToRgb, rgbToLab } from '../phase5/labUtil.js';
import {
  applyMaterialModel,
  type MaterialMaps,
  type MaterialModelParams,
} from '../phase7/materialModel.js';

export interface Phase7cRegionalBoost {
  /** Added on top of locked 7B micro (upper region only, feathered). */
  extraMicro: number;
  /** Added on top of locked 7B structure (upper region only); 0 for variant A. */
  extraStructure: number;
}

/**
 * Locked 7B globally, then source-derived micro/structure boost in upper upholstery only.
 * Seam and highlight strengths unchanged everywhere.
 */
export function applyPhase7c(
  base6a: RgbaImage,
  upholstery: Mask,
  maps: MaterialMaps,
  base7b: MaterialModelParams,
  upperWeights: Float32Array,
  boost: Phase7cRegionalBoost,
): RgbaImage {
  const image7b = applyMaterialModel(base6a, upholstery, maps, base7b);
  const out = Buffer.from(image7b.data);
  const { width, height, channels } = image7b;

  for (let j = 0; j < width * height; j++) {
    const w = upperWeights[j];
    if (w <= 0 || upholstery.data[j] < 128) continue;
    if (boost.extraMicro <= 0 && boost.extraStructure <= 0) continue;

    const p = j * channels;
    const lab = rgbToLab(out[p], out[p + 1], out[p + 2]);
    let L = lab.L;
    L += w * boost.extraMicro * maps.micro[j];
    L += w * boost.extraStructure * maps.structure[j];
    const rgb = labToRgb(L, lab.a, lab.b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
  }

  return { data: out, width, height, channels };
}
