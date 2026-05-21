import type { RealismPassParams } from '../phase5/realism.js';

export interface Stage5cVariant {
  id: 'A' | 'B' | 'C';
  label: string;
  params: RealismPassParams;
}

/** Micro-refinement targets (full strengths); delta applied on Stage 5B base. */
export const STAGE5C_VARIANTS: Stage5cVariant[] = [
  {
    id: 'A',
    label: '5C A',
    params: {
      detailStrength: 0.26,
      highlightStrength: 0.09,
      aVarAmp: 0.12,
      bVarAmp: 0.18,
    },
  },
  {
    id: 'B',
    label: '5C B',
    params: {
      detailStrength: 0.28,
      highlightStrength: 0.09,
      aVarAmp: 0.13,
      bVarAmp: 0.2,
    },
  },
  {
    id: 'C',
    label: '5C C',
    params: {
      detailStrength: 0.27,
      highlightStrength: 0.1,
      aVarAmp: 0.12,
      bVarAmp: 0.19,
    },
  },
];

/** Locked Stage 5C C — best final refinement candidate */
export const LOCKED_5C_C = {
  stage: '5C-C',
  lockedFrom: 'Stage 5C variant C',
  detailStrength: 0.27,
  highlightStrength: 0.1,
  aVariationAmplitude: 0.12,
  bVariationAmplitude: 0.19,
  base: 'Stage 5B on Stage 4B-v3',
} as const;

export const LOCKED_5C_C_PARAMS: RealismPassParams = {
  detailStrength: LOCKED_5C_C.detailStrength,
  highlightStrength: LOCKED_5C_C.highlightStrength,
  aVarAmp: LOCKED_5C_C.aVariationAmplitude,
  bVarAmp: LOCKED_5C_C.bVariationAmplitude,
};
