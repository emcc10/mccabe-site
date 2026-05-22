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
