import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { labToRgb, rgbToLab } from '../phase5/labUtil.js';
import type { SourceStructureGates } from '../phase9/sourceStructure.js';
import { type CleanSwatchMaterial, sampleCleanMaterial } from './swatchSanitize.js';

export interface CleanSwatchApplyParams {
  grainStrength: number;
  mottleStrength: number;
  colorBiasStrength: number;
  formStrength: number;
  sampleScale: number;
}

const GRAIN_SEED = 41;
const MOTTLE_SEED = 73;
const BIAS_A_SEED = 109;
const BIAS_B_SEED = 151;

export function applyCleanSwatchMaterial(
  base: RgbaImage,
  upholstery: Mask,
  clean: CleanSwatchMaterial,
  gates: SourceStructureGates,
  materialWeight: Float32Array,
  params: CleanSwatchApplyParams,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;
  const pw = clean.width;
  const ph = clean.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      const w = materialWeight[j];
      if (w <= 0.002) continue;

      const p = j * channels;
      const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);
      let L = lab.L;
      let a = lab.a;
      let b = lab.b;

      const g = sampleCleanMaterial(clean.grain, pw, ph, x, y, params.sampleScale, GRAIN_SEED);
      const m = sampleCleanMaterial(
        clean.mottle,
        pw,
        ph,
        x,
        y,
        params.sampleScale * 0.88,
        MOTTLE_SEED,
      );
      const ba = sampleCleanMaterial(
        clean.colorBiasA,
        pw,
        ph,
        x,
        y,
        params.sampleScale * 0.8,
        BIAS_A_SEED,
      );
      const bb = sampleCleanMaterial(
        clean.colorBiasB,
        pw,
        ph,
        x,
        y,
        params.sampleScale * 0.8,
        BIAS_B_SEED,
      );

      L += w * params.formStrength * gates.formLow[j];
      L += w * params.grainStrength * g;
      L += w * params.mottleStrength * m;
      a += w * params.colorBiasStrength * ba;
      b += w * params.colorBiasStrength * bb;

      const rgb = labToRgb(L, a, b);
      out[p] = rgb.r;
      out[p + 1] = rgb.g;
      out[p + 2] = rgb.b;
      if (channels === 4) out[p + 3] = base.data[p + 3];
    }
  }

  return { data: out, width, height, channels };
}
