export const STAGE5_HIGHLIGHT_STRENGTH = 0.08;
export const STAGE5_A_VAR_AMP = 0.12;
export const STAGE5_B_VAR_AMP = 0.18;
export const STAGE5_DETAIL_BLUR_PX = 8;

export interface Stage5Variant {
  id: 'A' | 'B' | 'C';
  label: string;
  detailStrength: number;
}

export const STAGE5_VARIANTS: Stage5Variant[] = [
  { id: 'A', label: 'A LIGHT DETAIL', detailStrength: 0.18 },
  { id: 'B', label: 'B MEDIUM DETAIL', detailStrength: 0.24 },
  { id: 'C', label: 'C STRONGER DETAIL', detailStrength: 0.3 },
];
