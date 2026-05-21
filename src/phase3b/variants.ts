export interface Stage3bVariant {
  id: string;
  label: string;
  targetLab: { l: number; a: number; b: number };
  preserveLuminance: number;
  chromaBlend: number;
  outputFile: string;
}

export const STAGE3B_VARIANTS: Stage3bVariant[] = [
  {
    id: 'A',
    label: 'A: Stage3 baseline',
    targetLab: { l: 74.2, a: 1.8, b: 11.4 },
    preserveLuminance: 0.88,
    chromaBlend: 0.72,
    outputFile: 'stage3b-variant-A.png',
  },
  {
    id: 'B',
    label: 'B: higher L, same a/b',
    targetLab: { l: 79.0, a: 1.5, b: 10.0 },
    preserveLuminance: 0.88,
    chromaBlend: 0.72,
    outputFile: 'stage3b-variant-B.png',
  },
  {
    id: 'C',
    label: 'C: higher L, lower b',
    targetLab: { l: 81.0, a: 1.2, b: 8.4 },
    preserveLuminance: 0.87,
    chromaBlend: 0.74,
    outputFile: 'stage3b-variant-C.png',
  },
  {
    id: 'D',
    label: 'D: higher L, lower a/b',
    targetLab: { l: 82.5, a: 0.8, b: 7.0 },
    preserveLuminance: 0.87,
    chromaBlend: 0.76,
    outputFile: 'stage3b-variant-D.png',
  },
  {
    id: 'E',
    label: 'E: light neutral warm ivory',
    targetLab: { l: 84.0, a: 0.6, b: 6.2 },
    preserveLuminance: 0.86,
    chromaBlend: 0.78,
    outputFile: 'stage3b-variant-E.png',
  },
  {
    id: 'F',
    label: 'F: swatch-biased test',
    targetLab: { l: 85.0, a: 1.0, b: 7.5 },
    preserveLuminance: 0.85,
    chromaBlend: 0.8,
    outputFile: 'stage3b-variant-F.png',
  },
];

export function variantSettingsLine(v: Stage3bVariant): string {
  const { l, a, b } = v.targetLab;
  return `L=${l} a=${a} b=${b} pl=${v.preserveLuminance} cb=${v.chromaBlend}`;
}
