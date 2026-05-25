import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { clamp, labToRgb, rgbToLab } from '../phase5/labUtil.js';
import { compareUpholsteryImages, computeUpholsteryDeltaStats } from '../phase95/imageCompare.js';
import { panelWarpForNorm, sofaToSwatchUVPanel, type PanelWarpContext } from '../phaseDetail2/panelUV.js';
import { sampleDetailBilinear, type FineGrainLayers } from './fineGrainExtract.js';

export interface Detail3Params {
  targetMeanDeltaL: number;
  softLightMix: number;
  directLScale: number;
  softLightScale: number;
  grainMix: number;
  mottleMix: number;
  maxDeltaL: number;
  chromaStrength: number;
  sampleScale: number;
}

/** Aggressive peak clamp — removes cloudy blotches. */
function detailGain(d: number): number {
  return Math.tanh(d * 1.15) * 0.68;
}

function softLightL(baseL: number, detail: number, amount: number): number {
  const d = clamp(detail * amount, -0.65, 0.65);
  const blend = 0.5 + 0.5 * d;
  const n = clamp(baseL / 100, 0.04, 0.96);
  let out: number;
  if (n < 0.5) out = 2 * n * blend;
  else out = 1 - 2 * (1 - n) * (1 - blend);
  return clamp(out * 100, 0, 100);
}

function sampleFineDetail(
  layers: FineGrainLayers,
  u: number,
  v: number,
  grainMix: number,
  mottleMix: number,
): number {
  const pw = layers.width;
  const ph = layers.height;
  const g = sampleDetailBilinear(layers.grain, pw, ph, u, v);
  const m = sampleDetailBilinear(layers.mottle, pw, ph, u * 0.96, v * 0.96);
  return detailGain(g * grainMix + m * mottleMix);
}

export function applyDetail3(
  base: RgbaImage,
  upholstery: Mask,
  layers: FineGrainLayers,
  weight: Float32Array,
  backScale: Float32Array,
  strength: number,
  params: Detail3Params,
  panelCtx: PanelWarpContext | null,
): RgbaImage {
  const out = Buffer.from(base.data);
  const { width, height, channels } = base;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      const w = weight[j] * backScale[j];
      if (w <= 0.002) continue;

      let warp = { scaleMul: 1, uOffset: 0, vOffset: 0, rot: 0 };
      if (panelCtx) {
        const xNorm = (x - panelCtx.bb.minX) / panelCtx.spanX;
        const yNorm = (y - panelCtx.bb.minY) / panelCtx.spanY;
        warp = panelWarpForNorm(xNorm, yNorm);
      }
      const { u, v } = sofaToSwatchUVPanel(x, y, params.sampleScale, warp);
      const detail = sampleFineDetail(layers, u, v, params.grainMix, params.mottleMix);
      const ca = sampleDetailBilinear(layers.chromaA, layers.width, layers.height, u * 0.94, v * 0.94);
      const cb = sampleDetailBilinear(layers.chromaB, layers.width, layers.height, u * 0.94, v * 0.94);

      const p = j * channels;
      const lab = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);
      const effective = w * strength;

      const softL = softLightL(lab.L, detail, effective * params.softLightScale);
      const directL = lab.L + effective * detail * params.directLScale;
      const mix = params.softLightMix;
      let L = mix * softL + (1 - mix) * directL;

      const dL = L - lab.L;
      L = lab.L + clamp(dL, -params.maxDeltaL, params.maxDeltaL);

      const a = lab.a + w * params.chromaStrength * ca * 0.22;
      const b = lab.b + w * params.chromaStrength * cb * 0.22;

      const rgb = labToRgb(L, a, b);
      out[p] = rgb.r;
      out[p + 1] = rgb.g;
      out[p + 2] = rgb.b;
      if (channels === 4) out[p + 3] = base.data[p + 3];
    }
  }

  return { data: out, width, height, channels };
}

export function calibrateDetail3(
  base6a: RgbaImage,
  upholstery: Mask,
  layers: FineGrainLayers,
  weight: Float32Array,
  backScale: Float32Array,
  params: Detail3Params,
  panelCtx: PanelWarpContext | null,
): { image: RgbaImage; strength: number; validation: ReturnType<typeof compareUpholsteryImages> } {
  let lo = 0.05;
  let hi = 5;

  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const img = applyDetail3(base6a, upholstery, layers, weight, backScale, mid, params, panelCtx);
    const stats = computeUpholsteryDeltaStats(base6a, img, upholstery, 6);
    if (stats.meanAbsDeltaL < params.targetMeanDeltaL) lo = mid;
    else hi = mid;
  }

  const strength = (lo + hi) / 2;
  const image = applyDetail3(base6a, upholstery, layers, weight, backScale, strength, params, panelCtx);
  const validation = compareUpholsteryImages(base6a, image, upholstery);

  return { image, strength, validation };
}
