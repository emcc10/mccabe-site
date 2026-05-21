/** Stage 3C — lower preserveL sweep from locked 3B candidate F */

export interface Stage3cVariant {
  id: string;
  label: string;
  targetLab: { l: number; a: number; b: number };
  preserveLuminance: number;
  chromaBlend: number;
  outputFile: string;
}

export const STAGE3C_VARIANTS: Stage3cVariant[] = [
  {
    id: 'G',
    label: 'G: F base, preserveL=0.80',
    targetLab: { l: 85.0, a: 1.0, b: 7.5 },
    preserveLuminance: 0.8,
    chromaBlend: 0.8,
    outputFile: 'stage3c-variant-G.png',
  },
  {
    id: 'H',
    label: 'H: lighter, preserveL=0.78',
    targetLab: { l: 85.5, a: 0.9, b: 7.0 },
    preserveLuminance: 0.78,
    chromaBlend: 0.82,
    outputFile: 'stage3c-variant-H.png',
  },
  {
    id: 'I',
    label: 'I: lighter, preserveL=0.76',
    targetLab: { l: 86.0, a: 0.8, b: 6.8 },
    preserveLuminance: 0.76,
    chromaBlend: 0.84,
    outputFile: 'stage3c-variant-I.png',
  },
  {
    id: 'J',
    label: 'J: lightest pull, preserveL=0.74',
    targetLab: { l: 86.5, a: 0.8, b: 6.5 },
    preserveLuminance: 0.74,
    chromaBlend: 0.85,
    outputFile: 'stage3c-variant-J.png',
  },
];

export function variantSettingsLine(v: Stage3cVariant): string {
  const { l, a, b } = v.targetLab;
  return `L=${l} a=${a} b=${b} pl=${v.preserveLuminance} cb=${v.chromaBlend}`;
}
