import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { labToRgb, rgbToLab } from '../phase5/labUtil.js';
import type { SourceStructureGates } from './sourceStructure.js';
import { sampleTiled, type SwatchDerivedMaps } from './swatchMaps.js';

export interface SwatchTransferParams {
  grainStrength: number;
  mottleStrength: number;
  colorBiasStrength: number;
  /** Gentle source form anchor (structure only, not source grain). */
  formStrength: number;
  tileScale: number;
}

export function applySwatchTransfer(
  base: RgbaImage,
  upholstery: Mask,
  swatchMaps: SwatchDerivedMaps,
  gates: SourceStructureGates,
  materialWeight: Float32Array,
  params: SwatchTransferParams,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;
  const { grain, mottle, colorBiasA, colorBiasB } = swatchMaps;
  const pw = swatchMaps.width;
  const ph = swatchMaps.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      const w = materialWeight[j];
      if (w <= 0.001) continue;

      const p = j * channels;
      const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);
      let L = lab.L;
      let a = lab.a;
      let b = lab.b;

      const g = sampleTiled(grain, pw, ph, x, y, params.tileScale);
      const m = sampleTiled(mottle, pw, ph, x, y, params.tileScale * 0.82);
      const ba = sampleTiled(colorBiasA, pw, ph, x, y, params.tileScale * 0.75);
      const bb = sampleTiled(colorBiasB, pw, ph, x, y, params.tileScale * 0.75);

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
