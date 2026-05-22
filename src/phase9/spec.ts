import type { SwatchTransferParams } from './swatchTransfer.js';

export interface Phase9Variant {
  id: 'A' | 'B';
  label: string;
  intent: string;
  params: SwatchTransferParams;
}

/** Phase 9 — swatch-derived material transfer (2 variants). */
export const PHASE9_VARIANTS: Phase9Variant[] = [
  {
    id: 'A',
    label: '9A LIGHT SWATCH',
    intent: 'Lighter swatch texture influence; conservative / cleaner',
    params: {
      grainStrength: 1.1,
      mottleStrength: 0.75,
      colorBiasStrength: 0.35,
      formStrength: 0.04,
      tileScale: 0.42,
    },
  },
  {
    id: 'B',
    label: '9B STRONGER SWATCH',
    intent: 'Slightly stronger swatch grain + mottle; still subtle',
    params: {
      grainStrength: 1.55,
      mottleStrength: 1.05,
      colorBiasStrength: 0.48,
      formStrength: 0.04,
      tileScale: 0.44,
    },
  },
];
