import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import {
  STAGE5_A_VAR_AMP,
  STAGE5_B_VAR_AMP,
  STAGE5_HIGHLIGHT_STRENGTH,
  type Stage5Variant,
} from './spec.js';
import {
  buildSourceTextureMaps,
  labToRgb,
  rgbToLab,
  type SourceTextureMaps,
} from './labUtil.js';

export interface RealismPassParams {
  detailStrength: number;
  highlightStrength: number;
  aVarAmp: number;
  bVarAmp: number;
}

export function applyRealismPass(
  base: RgbaImage,
  source: RgbaImage,
  upholstery: Mask,
  maps: SourceTextureMaps,
  params: RealismPassParams,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;

    const p = j * channels;
    const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);

    let L = lab.L + params.detailStrength * maps.lDetail[j];

    const hi = maps.highlight[j];
    const lift = params.highlightStrength * 11 * hi * (1 - 0.4 * hi);
    L += lift;

    const a = lab.a + params.aVarAmp * maps.aResidual[j];
    const b = lab.b + params.bVarAmp * maps.bResidual[j];

    const rgb = labToRgb(L, a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = base.data[p + 3];
  }

  return { data: out, width, height, channels };
}

/** Incremental realism on top of an existing pass (e.g. Stage 5B → 5C micro-refinement). */
export function applyRealismDeltaPass(
  base: RgbaImage,
  upholstery: Mask,
  maps: SourceTextureMaps,
  delta: RealismPassParams,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;

    const p = j * channels;
    const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);

    let L = lab.L + delta.detailStrength * maps.lDetail[j];
    const hi = maps.highlight[j];
    L += delta.highlightStrength * 11 * hi * (1 - 0.4 * hi);

    const a = lab.a + delta.aVarAmp * maps.aResidual[j];
    const b = lab.b + delta.bVarAmp * maps.bResidual[j];

    const rgb = labToRgb(L, a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = base.data[p + 3];
  }

  return { data: out, width, height, channels };
}

export function realismParamsForVariant(variant: Stage5Variant): RealismPassParams {
  return {
    detailStrength: variant.detailStrength,
    highlightStrength: STAGE5_HIGHLIGHT_STRENGTH,
    aVarAmp: STAGE5_A_VAR_AMP,
    bVarAmp: STAGE5_B_VAR_AMP,
  };
}

export { buildSourceTextureMaps };
