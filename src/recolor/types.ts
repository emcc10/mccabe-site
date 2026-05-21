export interface ProductRenderAssets {
  productCode: string;
  baseImageUrl: string;
  alphaMaskUrl?: string;
  upholsteryMaskUrl?: string;
  legMaskUrl?: string;
  trimMaskUrl?: string;
  shadowMapUrl?: string;
  detailMapUrl?: string;
  highlightMapUrl?: string;
  segmentationApproved: boolean;
  updatedAt: string;
}

export interface SwatchRecolorTuning {
  /** 0–1: how much original photo L to keep (lower = more swatch lightness) */
  preserveLuminance?: number;
  /** 0–1: how much swatch a/b chroma to apply */
  textureBlend?: number;
}

export interface SwatchProfile {
  code: string;
  label: string;
  lab: { l: number; a: number; b: number };
  chromaVariation: number;
  grainStrength: number;
  highlightSoftness: number;
  textureMapUrl?: string;
  recolor?: SwatchRecolorTuning;
}

export interface SingleProductConfig {
  productCode: string;
  preserveLuminance: number;
  shadowStrength: number;
  detailStrength: number;
  chromaVariationStrength: number;
  highlightCompression: number;
  textureBlend: number;
  upholsteryExpandPx: number;
  upholsteryContractPx: number;
  legProtectionExpandPx: number;
  smoothRadiusPx: number;
  minRegionArea: number;
}

export interface RenderRequest {
  productCode: string;
  swatchCode: string;
  forceRebuild?: boolean;
}

export interface RenderResult {
  imageUrl: string;
  /** Absolute path under public/render-cache only */
  outputPath: string;
  sourcePath: string;
  cacheKey: string;
  productCode: string;
  swatchCode: string;
  segmentationApproved: boolean;
}

export interface ImageRGBA {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

export interface MaskData {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface SegmentationResult {
  alpha: MaskData;
  upholstery: MaskData;
  legs: MaskData;
  trim: MaskData;
}

export interface QAReport {
  passed: boolean;
  warnings: string[];
  errors: string[];
  legBleedRatio: number;
  detachedArtifactCount: number;
  contourDriftRatio: number;
  upholsteryLabVariance: number;
}
