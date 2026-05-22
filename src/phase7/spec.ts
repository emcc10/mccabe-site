import type { MaterialModelParams } from './materialModel.js';

export interface Phase7Variant {
  id: 'A' | 'B';
  label: string;
  params: MaterialModelParams;
}

/** Phase 7 — material model reset (2 variants only). */
export const PHASE7_VARIANTS: Phase7Variant[] = [
  {
    id: 'A',
    label: '7A MORE SEAM',
    params: {
      structureStrength: 0.24,
      seamStrength: 0.34,
      microStrength: 0.07,
      highlightStrength: 0.035,
    },
  },
  {
    id: 'B',
    label: '7B MORE MICRO',
    params: {
      structureStrength: 0.24,
      seamStrength: 0.22,
      microStrength: 0.13,
      highlightStrength: 0.035,
    },
  },
];
