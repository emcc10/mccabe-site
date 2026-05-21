import type { RealismV2Params } from './realismV2.js';

export const REALISM_V2_SHARED = {
  fineBlurPx: 4,
  coarseBlurPx: 12,
  seamBoost: 0.28,
} as const;

export interface Phase6bVariant {
  id: 'A' | 'B' | 'C';
  label: string;
  params: RealismV2Params;
}

export const PHASE6B_VARIANTS: Phase6bVariant[] = [
  {
    id: 'A',
    label: '6B A STRONG DETAIL',
    params: {
      ...REALISM_V2_SHARED,
      detailStrength: 0.36,
      highlightStrength: 0.1,
      aVarAmp: 0.12,
      bVarAmp: 0.19,
    },
  },
  {
    id: 'B',
    label: '6B B STRONG DETAIL / SOFT HI',
    params: {
      ...REALISM_V2_SHARED,
      detailStrength: 0.36,
      highlightStrength: 0.06,
      aVarAmp: 0.12,
      bVarAmp: 0.19,
    },
  },
  {
    id: 'C',
    label: '6B C SOFT HI + MICRO CHROMA',
    params: {
      ...REALISM_V2_SHARED,
      detailStrength: 0.36,
      highlightStrength: 0.06,
      aVarAmp: 0.14,
      bVarAmp: 0.21,
    },
  },
];
