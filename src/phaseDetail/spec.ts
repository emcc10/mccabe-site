import type { DetailTransferParams } from './applyDetailLayer.js';

export interface PhaseDetailVariant {
  id: 'A' | 'B';
  label: string;
  intent: string;
  params: DetailTransferParams;
}

/** Detail-layer transfer — band-pass swatch extract + soft-light L (NOT stochastic Phase 9/10). */
export const PHASE_DETAIL_VARIANTS: PhaseDetailVariant[] = [
  {
    id: 'A',
    label: 'DETAIL-A CAL 1.0',
    intent: 'Calibrated to ~1.0 mean |ΔL| vs 6A; soft-light heavy',
    params: {
      targetMeanDeltaL: 1.0,
      softLightMix: 0.72,
      chromaStrength: 0.12,
      sampleScale: 0.55,
    },
  },
  {
    id: 'B',
    label: 'DETAIL-B CAL 1.5',
    intent: 'Calibrated to ~1.5 mean |ΔL| vs 6A; slightly more direct micro-contrast',
    params: {
      targetMeanDeltaL: 1.5,
      softLightMix: 0.58,
      chromaStrength: 0.16,
      sampleScale: 0.58,
    },
  },
];

export const VISIBLE_THRESHOLD = {
  minMeanAbsDeltaL: 1.0,
  maxSsimL: 0.99,
} as const;
