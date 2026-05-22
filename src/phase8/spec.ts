import type { FreqMaterialParams } from './freqMaterial.js';

export interface Phase8Variant {
  id: 'A' | 'B';
  label: string;
  params: FreqMaterialParams;
  intent: string;
}

/** Phase 8 — frequency-separated material recovery (2 variants). */
export const PHASE8_VARIANTS: Phase8Variant[] = [
  {
    id: 'A',
    label: '8A STRONGER MID',
    intent: 'Stronger mid-frequency leather body; restrained gated high-frequency seams',
    params: {
      lowStrength: 0.07,
      midStrength: 0.24,
      highStrength: 0.1,
      highConfidencePercentile: 0.68,
    },
  },
  {
    id: 'B',
    label: '8B SELECTIVE HIGH',
    intent: 'Slightly less mid body; more selective high-frequency seam/crease recovery',
    params: {
      lowStrength: 0.07,
      midStrength: 0.17,
      highStrength: 0.15,
      highConfidencePercentile: 0.58,
    },
  },
];
