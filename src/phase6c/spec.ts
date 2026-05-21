import type { RealismV2Params } from '../phase6b/realismV2.js';
import { LOCKED_6B_B } from '../phase6b/spec.js';

export interface Phase6cVariant {
  id: 'A' | 'B' | 'C';
  label: string;
  naturalization: Pick<RealismV2Params, 'fineDetailScale' | 'seamBoost' | 'luminanceIrregularityAmp'>;
}

/** Naturalization deltas on locked 6B-B (single realism pass from 6A). */
export const PHASE6C_VARIANTS: Phase6cVariant[] = [
  {
    id: 'A',
    label: '6C A +FINE DETAIL',
    naturalization: { fineDetailScale: 1.12, seamBoost: 0.28, luminanceIrregularityAmp: 0 },
  },
  {
    id: 'B',
    label: '6C B +FINE / -SEAM',
    naturalization: { fineDetailScale: 1.12, seamBoost: 0.18, luminanceIrregularityAmp: 0 },
  },
  {
    id: 'C',
    label: '6C C +L IRREGULARITY',
    naturalization: { fineDetailScale: 1.12, seamBoost: 0.18, luminanceIrregularityAmp: 0.45 },
  },
];

export function realismParamsFor6cVariant(variant: Phase6cVariant): RealismV2Params {
  return {
    ...LOCKED_6B_B,
    ...variant.naturalization,
  };
}

/** Locked Phase 6C-B realism params (not final Bali Silk). */
export const LOCKED_6C_B_PARAMS: RealismV2Params = {
  detailStrength: 0.36,
  highlightStrength: 0.06,
  aVarAmp: 0.12,
  bVarAmp: 0.19,
  fineBlurPx: 4,
  coarseBlurPx: 12,
  seamBoost: 0.18,
  fineDetailScale: 1.12,
  luminanceIrregularityAmp: 0,
};

export const LOCKED_6C_B = {
  stage: '6C-B',
  lockedFrom: 'Phase 6C variant B (+fine detail / -seam)',
  notFinalBaliSilk: true,
  params: LOCKED_6C_B_PARAMS,
  pipeline: ['Stage 4B-v3', 'Phase 6A bottom seam fix', 'Phase 6B-B base + Phase 6C-B naturalization'],
} as const;
