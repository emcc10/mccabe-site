import type { SwatchProfile } from '../spec.js';
import type { HeroPromptParts } from './prompt.js';

export interface HeroInputBundlePaths {
  bundleDir: string;
  upholsteryEditMask: string;
  protectedMask: string;
  referenceBaseRecolor: string;
  referenceCleanSwatch: string;
  prompt: string;
  spec: string;
}

export interface HeroInputBundle {
  paths: HeroInputBundlePaths;
  spec: Record<string, unknown>;
  promptParts: HeroPromptParts;
}

export interface HeroGenerativeRequest {
  profile: SwatchProfile;
  bundle: HeroInputBundle;
  /** Full-size RGBA source (geometry truth) */
  sourcePath: string;
}

export interface HeroGenerativeResult {
  /** Raw generative output before leg/background composite */
  generativeRgbPath: string;
  providerId: string;
  metadata?: Record<string, unknown>;
}

export interface HeroPipelineResult {
  swatchCode: string;
  profile: SwatchProfile;
  inputBundle: HeroInputBundle;
  generative: HeroGenerativeResult | null;
  outputs: {
    heroMaster: string;
    heroComparison: string;
    status: string;
    exportCopy?: string;
  };
  skippedGenerative: boolean;
  message: string;
}

export interface HeroExportManifest {
  swatchCode: string;
  heroMaster: string;
  heroComparison: string;
  inputBundleDir: string;
  status: string;
  previewBaseRecolor: string;
}
