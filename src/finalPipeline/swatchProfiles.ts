import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { SwatchProfile } from './spec.js';
import { DEFAULT_SWATCH_CODE, resolveSwatchImagePath } from './paths.js';

const PROFILES_PATH = join(dirname(fileURLToPath(import.meta.url)), 'swatch-profiles.json');

export const REALISM_VARIANTS = [
  {
    id: 'A' as const,
    label: 'FINAL-A',
    intent: 'Cleaner / softer realism — conservative',
    grainMul: 0.72,
    mottleMul: 0.62,
    colorBiasMul: 0.85,
    formStrength: 0.02,
    sampleScale: 0.38,
    visibilityGain: 0.88,
  },
  {
    id: 'B' as const,
    label: 'FINAL-B',
    intent: 'Balanced realism — target version',
    grainMul: 1.0,
    mottleMul: 0.92,
    colorBiasMul: 1.0,
    formStrength: 0.025,
    sampleScale: 0.4,
    visibilityGain: 1.0,
  },
  {
    id: 'C' as const,
    label: 'FINAL-C',
    intent: 'Slightly stronger realism — still refined, not noisy',
    grainMul: 1.22,
    mottleMul: 1.12,
    colorBiasMul: 1.08,
    formStrength: 0.028,
    sampleScale: 0.42,
    visibilityGain: 1.18,
  },
];

let cached: SwatchProfile[] | null = null;

export function loadSwatchProfiles(): SwatchProfile[] {
  if (!cached) {
    cached = JSON.parse(readFileSync(PROFILES_PATH, 'utf8')) as SwatchProfile[];
  }
  return cached;
}

export function getSwatchProfile(code: string): SwatchProfile {
  const profile = loadSwatchProfiles().find((p) => p.code.toUpperCase() === code.toUpperCase());
  if (!profile) {
    throw new Error(`Unknown swatch profile: ${code}. Add it to src/finalPipeline/swatch-profiles.json`);
  }
  return profile;
}

export function getSwatchImagePath(code: string): string {
  return resolveSwatchImagePath(getSwatchProfile(code).swatchFile);
}
