/** Stage 3E — lighter/cleaner sweep from locked 3D-J */

export interface Stage3eVariant {
  id: string;
  label: string;
  targetLab: { l: number; a: number; b: number };
  preserveLuminance: number;
  chromaBlend: number;
  outputFile: string;
}

export const STAGE3E_VARIANTS: Stage3eVariant[] = [
  {
    id: 'K',
    label: 'K: from J, L=88',
    targetLab: { l: 88.0, a: 0.7, b: 5.8 },
    preserveLuminance: 0.72,
    chromaBlend: 0.86,
    outputFile: 'stage3e-variant-K.png',
  },
  {
    id: 'L',
    label: 'L: L=89, cleaner',
    targetLab: { l: 89.0, a: 0.6, b: 5.2 },
    preserveLuminance: 0.7,
    chromaBlend: 0.87,
    outputFile: 'stage3e-variant-L.png',
  },
  {
    id: 'M',
    label: 'M: L=90, lighter',
    targetLab: { l: 90.0, a: 0.5, b: 4.8 },
    preserveLuminance: 0.68,
    chromaBlend: 0.88,
    outputFile: 'stage3e-variant-M.png',
  },
  {
    id: 'N',
    label: 'N: L=91, lightest',
    targetLab: { l: 91.0, a: 0.5, b: 4.5 },
    preserveLuminance: 0.66,
    chromaBlend: 0.89,
    outputFile: 'stage3e-variant-N.png',
  },
];

export function variantSettingsLine(v: Stage3eVariant): string {
  const { l, a, b } = v.targetLab;
  return `L=${l} a=${a} b=${b} pl=${v.preserveLuminance} cb=${v.chromaBlend}`;
}
