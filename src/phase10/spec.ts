import type { CleanSwatchApplyParams } from '../phase9reset/apply.js';
import { LOCKED_9RESET_B_PARAMS } from '../phase9reset/spec.js';

export interface Phase10Variant {
  id: 'A' | 'B';
  label: string;
  intent: string;
  params: CleanSwatchApplyParams;
}

/** Phase 10 — one real stronger swatch transfer attempt (2 variants). */
export const PHASE10_VARIANTS: Phase10Variant[] = [
  {
    id: 'A',
    label: '10A STRONG CLEAN',
    intent: 'Materially stronger than 9RESET-B; cleaner / safer',
    params: {
      grainStrength: 1.05,
      mottleStrength: 0.72,
      colorBiasStrength: 0.24,
      formStrength: 0.03,
      sampleScale: 0.4,
    },
  },
  {
    id: 'B',
    label: '10B STRONG MAX',
    intent: 'Clearly stronger than 10A; still gated open-fields only',
    params: {
      grainStrength: 1.48,
      mottleStrength: 1.02,
      colorBiasStrength: 0.32,
      formStrength: 0.025,
      sampleScale: 0.42,
    },
  },
];

export const REFERENCE_9RESET_B = LOCKED_9RESET_B_PARAMS;
