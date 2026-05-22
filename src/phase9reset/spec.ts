import type { CleanSwatchApplyParams } from './apply.js';

export interface Phase9ResetVariant {
  id: 'A' | 'B';
  label: string;
  intent: string;
  params: CleanSwatchApplyParams;
}

export const PHASE9RESET_VARIANTS: Phase9ResetVariant[] = [
  {
    id: 'A',
    label: '9RESET-A CLEAN LIGHT',
    intent: 'Conservative clean swatch grain + mottle',
    params: {
      grainStrength: 0.42,
      mottleStrength: 0.28,
      colorBiasStrength: 0.11,
      formStrength: 0.03,
      sampleScale: 0.38,
    },
  },
  {
    id: 'B',
    label: '9RESET-B CLEAN STRONGER',
    intent: 'Slightly stronger clean swatch transfer; still subtle',
    params: {
      grainStrength: 0.58,
      mottleStrength: 0.38,
      colorBiasStrength: 0.15,
      formStrength: 0.03,
      sampleScale: 0.4,
    },
  },
];

/** Locked Phase 9RESET-B — current best candidate (not final Bali Silk). */
export const LOCKED_9RESET_B_PARAMS: CleanSwatchApplyParams = {
  grainStrength: 0.58,
  mottleStrength: 0.38,
  colorBiasStrength: 0.15,
  formStrength: 0.03,
  sampleScale: 0.4,
};

export const LOCKED_9RESET_B = {
  stage: '9RESET-B',
  lockedFrom: 'Phase 9 reset variant B (clean swatch stochastic apply)',
  notFinalBaliSilk: true,
  params: LOCKED_9RESET_B_PARAMS,
  pipeline: [
    'Stage 4B-v3',
    'Phase 6A bottom seam fix',
    'Phase 9 reset swatch sanitization + stochastic material apply',
  ],
} as const;
