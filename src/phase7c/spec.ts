import type { Phase7cRegionalBoost } from './apply.js';

export interface Phase7cVariant {
  id: 'A' | 'B';
  label: string;
  boost: Phase7cRegionalBoost;
}

/** Phase 7C — upper-surface texture recovery on locked 7B (2 variants). */
export const PHASE7C_VARIANTS: Phase7cVariant[] = [
  {
    id: 'A',
    label: '7C-A +MICRO UPPER',
    boost: { extraMicro: 0.06, extraStructure: 0 },
  },
  {
    id: 'B',
    label: '7C-B +MICRO+STRUCT UPPER',
    boost: { extraMicro: 0.06, extraStructure: 0.07 },
  },
];

/** Locked Phase 7C-B — current best candidate (not final Bali Silk). */
export const LOCKED_7C_B = {
  stage: '7C-B',
  lockedFrom: 'Phase 7C variant B (upper micro + structure on locked 7B)',
  notFinalBaliSilk: true,
  base7bUnchanged: true,
  regionalBoost: { extraMicro: 0.06, extraStructure: 0.07 },
  upperRegionOnly: true,
  noSeamIncrease: true,
  pipeline: [
    'Stage 4B-v3',
    'Phase 6A bottom seam fix',
    'Phase 7B material model',
    'Phase 7C-B upper-region boost',
  ],
} as const;

export const LOCKED_7C_B_BOOST = LOCKED_7C_B.regionalBoost;
