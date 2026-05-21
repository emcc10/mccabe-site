import type { RelativeLRemapParams } from './recolor.js';

export interface Stage4Variant {
  id: string;
  label: string;
  outputFile: string;
  params: RelativeLRemapParams;
}

const CHROMA = {
  targetA: 0.3,
  targetB: 4.2,
  chromaSourceA: 0.12,
  chromaSourceB: 0.1,
  chromaTargetA: 0.88,
  chromaTargetB: 0.9,
};

export const STAGE4_VARIANTS: Stage4Variant[] = [
  {
    id: 'A',
    label: 'A RELATIVE L REMAP',
    outputFile: 'stage4-variant-A.png',
    params: {
      lLow: 70,
      lHigh: 90,
      mappedLBlend: 0.8,
      ...CHROMA,
    },
  },
  {
    id: 'B',
    label: 'B RELATIVE L REMAP',
    outputFile: 'stage4-variant-B.png',
    params: {
      lLow: 72,
      lHigh: 92,
      mappedLBlend: 0.82,
      ...CHROMA,
    },
  },
  {
    id: 'C',
    label: 'C RELATIVE L REMAP',
    outputFile: 'stage4-variant-C.png',
    params: {
      lLow: 74,
      lHigh: 94,
      mappedLBlend: 0.85,
      ...CHROMA,
    },
  },
];

export function variantSettingsLine(v: Stage4Variant): string {
  const p = v.params;
  return `L${p.lLow}-${p.lHigh} map=${(p.mappedLBlend * 100).toFixed(0)}% a/b→(${p.targetA},${p.targetB})`;
}
