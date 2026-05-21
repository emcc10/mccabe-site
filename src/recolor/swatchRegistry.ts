import type { SwatchProfile } from './types.js';

const SWATCHES: SwatchProfile[] = [
  {
    code: 'BALI-SILK',
    label: 'Bali Silk',
    lab: { l: 74.2, a: 1.8, b: 11.4 },
    chromaVariation: 0.22,
    grainStrength: 0.2,
    highlightSoftness: 0.18,
    textureMapUrl: '/swatch-assets/bali-silk-texture.png',
  },
  {
    code: 'REIN-GREY',
    label: 'Rein Grey',
    lab: { l: 58.5, a: 0.4, b: 2.1 },
    chromaVariation: 0.18,
    grainStrength: 0.22,
    highlightSoftness: 0.2,
  },
  {
    code: 'EVOQUE-FROST',
    label: 'Evoque Frost',
    lab: { l: 82.1, a: -0.5, b: 4.2 },
    chromaVariation: 0.2,
    grainStrength: 0.19,
    highlightSoftness: 0.16,
  },
];

export function getSwatchProfile(code: string): SwatchProfile {
  const key = code.toUpperCase().replace(/\s+/g, '-');
  const sw = SWATCHES.find((s) => s.code === key);
  if (!sw) throw new Error(`Unknown swatch: ${code}`);
  return { ...sw };
}

export function listSwatches(): SwatchProfile[] {
  return SWATCHES.map((s) => ({ ...s }));
}
