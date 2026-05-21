/**
 * Stage 2 proof recolor — measurable constants only.
 * Stage 3 uses separate spec in ../phase3/spec.ts
 */
export const STAGE = 2 as const;

export const BALI_SILK_LAB = { l: 74.2, a: 1.8, b: 11.4 } as const;

/** preserveLuminance */
export const PRESERVE_LUMINANCE = 0.93;

/** a/b shift strength (chromaBlend) */
export const CHROMA_BLEND = 0.28;

/** texture/detail map contribution */
export const TEXTURE_DETAIL_CONTRIBUTION = 0;

/** highlight compression */
export const HIGHLIGHT_COMPRESSION = 0;

/** shadow map contribution */
export const SHADOW_MAP_CONTRIBUTION = 0;

/** chroma variation / drift */
export const CHROMA_DRIFT = 0;

/** RGB post-passes after recolor (blur, flatten, cleanup) */
export const POST_RGB_PASSES: string[] = [];

export const RECOLOR_FORMULA = [
  'For each pixel where upholsteryMask >= 128:',
  '  (L_src, a_src, b_src) = RGB_to_Lab(source.R, source.G, source.B)',
  '  L_out = L_src * PRESERVE_LUMINANCE + BALI_SILK_LAB.l * (1 - PRESERVE_LUMINANCE)',
  '  a_out = a_src * (1 - CHROMA_BLEND) + BALI_SILK_LAB.a * CHROMA_BLEND',
  '  b_out = b_src * (1 - CHROMA_BLEND) + BALI_SILK_LAB.b * CHROMA_BLEND',
  '  (R,G,B) = Lab_to_RGB(L_out, a_out, b_out)',
  'No other terms. No maps. No post on upholstery buffer.',
].join('\n');

export const COMPOSITE_RULES = [
  'If legMask >= 128: copy source RGB (+ source A if present) — restored, not excluded.',
  'Else if upholsteryMask >= 128 AND alphaMask >= 128: copy recolor RGB, A=255.',
  'Else if alphaMask < 128: RGB = (255,255,255), A=255.',
  'Alpha mask derived from source image only (channel A>=128 or L<248).',
  'No supersample feather, no blur, no second luminance pass after composite.',
].join('\n');

export function stage2SpecRecord() {
  return {
    stage: STAGE,
    branchIntent: 'Complete Stage 2 proof only; Stage 3 is separate',
    preserveLuminance: PRESERVE_LUMINANCE,
    chromaBlend: CHROMA_BLEND,
    targetLab: BALI_SILK_LAB,
    textureDetailContribution: TEXTURE_DETAIL_CONTRIBUTION,
    highlightCompression: HIGHLIGHT_COMPRESSION,
    shadowMapContribution: SHADOW_MAP_CONTRIBUTION,
    chromaDrift: CHROMA_DRIFT,
    postRgbPasses: POST_RGB_PASSES,
    recolorFormula: RECOLOR_FORMULA,
    compositeRules: COMPOSITE_RULES,
  };
}
