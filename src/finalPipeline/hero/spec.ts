import type { Mask } from '../../phase1/masks.js';
import type { SwatchProfile } from '../spec.js';
import type { HeroPromptParts } from './prompt.js';
import type { HeroQaReport } from './qa.js';
import type { HeroVariantSpec } from './variants.js';

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
  sourcePath: string;
  upholstery: Mask;
  variant: HeroVariantSpec;
}

export interface HeroGenerativeResult {
  generativeRgbPath: string;
  providerId: string;
  metadata?: Record<string, unknown>;
}

export interface HeroVariantRunResult {
  id: 'A' | 'B';
  label: string;
  variant: HeroVariantSpec;
  generativeRawPath: string;
  outputPath: string;
  qa: HeroQaReport;
  providerId: string;
  metadata?: Record<string, unknown>;
}

export interface HeroPipelineResult {
  swatchCode: string;
  profile: SwatchProfile;
  inputBundle: HeroInputBundle;
  providerId: string;
  variants: HeroVariantRunResult[];
  bestVariantId: 'A' | 'B' | null;
  outputs: {
    grid: string;
    spec: string;
    status: string;
    variantPaths: Record<'A' | 'B', string>;
    bestMaster: string;
  };
  skippedGenerative: boolean;
  message: string;
}

export interface HeroExportManifest {
  swatchCode: string;
  heroMaster: string;
  heroComparison: string;
  heroVariantA: string;
  heroVariantB: string;
  heroGrid: string;
  heroSpec: string;
  inputBundleDir: string;
  status: string;
  previewBaseRecolor: string;
  bestVariantId: 'A' | 'B' | null;
}
