import type { Detail3Params } from './applyDetailLayer3.js';

/** Based on DETAIL2-A — fine grain dominant, minimal mottle. */
export const PHASE_DETAIL3_VARIANTS = [
  {
    id: 'A',
    label: 'DETAIL3-A',
    intent: 'Fine grain only; target ΔL≈0.60; backs at ~58% strength',
    params: {
      targetMeanDeltaL: 0.6,
      softLightMix: 0.62,
      directLScale: 1.1,
      softLightScale: 0.46,
      grainMix: 0.78,
      mottleMix: 0.04,
      maxDeltaL: 2.3,
      chromaStrength: 0.07,
      sampleScale: 0.56,
    } satisfies Detail3Params,
  },
  {
    id: 'B',
    label: 'DETAIL3-B',
    intent: 'Slightly finer visibility; target ΔL≈0.68; grain 0.82',
    params: {
      targetMeanDeltaL: 0.68,
      softLightMix: 0.6,
      directLScale: 1.18,
      softLightScale: 0.47,
      grainMix: 0.82,
      mottleMix: 0.05,
      maxDeltaL: 2.45,
      chromaStrength: 0.08,
      sampleScale: 0.57,
    } satisfies Detail3Params,
  },
] as const;

export const DETAIL2_A_BASE = {
  path: 'phaseDetail2-variant-A.png',
  referenceParams: {
    targetMeanDeltaL: 0.75,
    mottleMix: 0.1,
    grainMix: 0.77,
    maxDeltaL: 2.6,
  },
} as const;
