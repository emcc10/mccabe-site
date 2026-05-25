import type { Detail2Params } from './applyDetailLayer2.js';

/** Based on DETAIL-A; reduced embossing, midtone-only, panel UV warp. */
export const PHASE_DETAIL2_VARIANTS = [
  {
    id: 'A',
    label: 'DETAIL2-A',
    intent: 'Target ΔL≈0.75; softer grain, minimal mottle, capped peaks',
    params: {
      targetMeanDeltaL: 0.75,
      softLightMix: 0.62,
      directLScale: 1.15,
      softLightScale: 0.48,
      grainMix: 0.77,
      mottleMix: 0.1,
      maxDeltaL: 2.6,
      chromaStrength: 0.09,
      sampleScale: 0.54,
    } satisfies Detail2Params,
  },
  {
    id: 'B',
    label: 'DETAIL2-B',
    intent: 'Target ΔL≈0.80; slightly more grain visibility, still capped',
    params: {
      targetMeanDeltaL: 0.8,
      softLightMix: 0.58,
      directLScale: 1.28,
      softLightScale: 0.5,
      grainMix: 0.85,
      mottleMix: 0.12,
      maxDeltaL: 2.8,
      chromaStrength: 0.1,
      sampleScale: 0.56,
    } satisfies Detail2Params,
  },
] as const;

/** DETAIL-A reference (directLScale 2.8, mix 0.72/0.28). */
export const DETAIL_A_REFERENCE = {
  directLScale: 2.8,
  softLightMix: 0.72,
  softLightScale: 0.55,
  grainMix: 0.62,
  mottleMix: 0.38,
} as const;
