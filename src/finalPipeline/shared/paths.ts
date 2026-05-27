import { join } from 'path';
import { FINAL_PIPELINE_DIR, finalPath, swatchCodeToSlug } from '../paths.js';

export const HERO_DIR = join(FINAL_PIPELINE_DIR, 'hero');

/** Stable preview export filename (alongside best-preview-master). */
export function previewExportPath(code: string): string {
  return finalPath(`preview-export-${swatchCodeToSlug(code)}.png`);
}

export function heroPath(name: string): string {
  return join(HERO_DIR, name);
}

export function heroInputBundleDir(code: string): string {
  return heroPath(`inputs-${swatchCodeToSlug(code)}`);
}

export function heroUpholsteryMaskPath(code: string): string {
  return join(heroInputBundleDir(code), 'upholstery-edit-mask.png');
}

export function heroProtectedMaskPath(code: string): string {
  return join(heroInputBundleDir(code), 'protected-mask.png');
}

export function heroReferenceBasePath(code: string): string {
  return join(heroInputBundleDir(code), 'reference-base-recolor.png');
}

export function heroReferenceSwatchPath(code: string): string {
  return join(heroInputBundleDir(code), 'reference-clean-swatch.png');
}

export function heroPromptPath(code: string): string {
  return join(heroInputBundleDir(code), 'prompt.txt');
}

export function heroSpecPath(code: string): string {
  return join(heroInputBundleDir(code), 'hero-spec.json');
}

export function heroMasterPath(code: string): string {
  return heroPath(`hero-master-${swatchCodeToSlug(code)}.png`);
}

export function heroComparisonPath(code: string): string {
  return heroPath(`hero-comparison-${swatchCodeToSlug(code)}.png`);
}

export function heroStatusPath(code: string): string {
  return heroPath(`HERO_STATUS-${swatchCodeToSlug(code)}.md`);
}
