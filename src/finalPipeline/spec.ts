import type { RelativeLRemapParams } from '../phase4/recolor.js';
import type { CleanSwatchApplyParams } from '../phase9reset/apply.js';

export type LightnessClass = 'light' | 'medium' | 'dark';
export type TextureClass = 'refined' | 'natural' | 'bold';

export interface SwatchProfile {
  code: string;
  swatchFile: string;
  targetLab: { l: number; a: number; b: number };
  grainStrength: number;
  mottleStrength: number;
  colorBiasStrength: number;
  highlightSoftness: number;
  lightnessClass: LightnessClass;
  textureClass: TextureClass;
  /** Stage-2 relative-L remap (defaults follow locked 4B-v3 calibration). */
  baseRecolor: Partial<RelativeLRemapParams>;
}

export interface RealismVariantSpec {
  id: 'A' | 'B' | 'C';
  label: string;
  intent: string;
  /** Multipliers applied on top of profile strengths for apply pass. */
  grainMul: number;
  mottleMul: number;
  colorBiasMul: number;
  formStrength: number;
  sampleScale: number;
  visibilityGain: number;
}

export interface RealismApplyParams extends CleanSwatchApplyParams {
  visibilityGain: number;
}

export interface QaArtifactReport {
  feetChanged: boolean;
  feetChangedPixels: number;
  silhouetteChanged: boolean;
  silhouetteChangedPixels: number;
  backgroundContaminated: boolean;
  backgroundContaminatedPixels: number;
  bottomSeamRegression: boolean;
  meanAbsDeltaL: number;
  visuallyMeaningful: boolean;
  verdict: string;
  failures: string[];
}

export interface VariantResult {
  id: 'A' | 'B' | 'C';
  label: string;
  path: string;
  applyParams: RealismApplyParams;
  qa: QaArtifactReport;
  compare: {
    meanAbsDeltaL: number;
    meanAbsDeltaRgb: number;
    ssimOnL: number;
    visuallyMeaningful: boolean;
    verdict: string;
  };
  score: number;
}

export interface FinalPipelineResult {
  swatchCode: string;
  profile: SwatchProfile;
  prep: {
    sourceClean: string;
    upholsteryMask: string;
    legMask: string;
    alphaMask: string;
    prepDebugOverlay: string;
  };
  baseRecolor: string;
  swatchOutputs: {
    cleanBase: string;
    cleanGrain: string;
    cleanMottle: string;
    cleanColorBias: string;
    cleanArtifactMask: string;
  };
  regionDebug: string;
  variants: VariantResult[];
  bestVariantId: 'A' | 'B' | 'C' | null;
  outputs: {
    grid: string;
    bestMaster: string;
    bestComparison: string;
    qaDiff: string;
    qaHeatmap: string;
    qaMetrics: string;
    status: string;
  };
  allVariantsFailed: boolean;
}
