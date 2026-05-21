/**
 * Stage 3 — same pipeline as Stage 2; stronger swatch match constants only.
 */
export const STAGE = 3 as const;

export const BALI_SILK_LAB = { l: 74.2, a: 1.8, b: 11.4 } as const;

/** More swatch L while keeping majority of source L structure */
export const PRESERVE_LUMINANCE = 0.88;

/** Stronger a/b pull toward swatch */
export const CHROMA_BLEND = 0.72;

export const TEXTURE_DETAIL_CONTRIBUTION = 0;
export const HIGHLIGHT_COMPRESSION = 0;
export const SHADOW_MAP_CONTRIBUTION = 0;
export const CHROMA_DRIFT = 0;
export const POST_RGB_PASSES: string[] = [];

export function stage3SpecRecord() {
  return {
    stage: STAGE,
    derivedFrom: 'stage2 pipeline (recolorUpholsteryMinimal + compositePhase2)',
    preserveLuminance: PRESERVE_LUMINANCE,
    chromaBlend: CHROMA_BLEND,
    targetLab: BALI_SILK_LAB,
    textureDetailContribution: TEXTURE_DETAIL_CONTRIBUTION,
    highlightCompression: HIGHLIGHT_COMPRESSION,
    shadowMapContribution: SHADOW_MAP_CONTRIBUTION,
    chromaDrift: CHROMA_DRIFT,
    postRgbPasses: POST_RGB_PASSES,
  };
}
