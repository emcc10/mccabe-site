import { join } from 'path';
import { BALI_SILK_SWATCH, PRODUCT_CODE, PRODUCT_DIR, REPO_ROOT, SOURCE_OUT } from '../phase1/paths.js';

export const FINAL_PIPELINE_DIR = join(PRODUCT_DIR, 'final-pipeline');

export function swatchCodeToSlug(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '-');
}

export function finalPath(name: string): string {
  return join(FINAL_PIPELINE_DIR, name);
}

export function baseRecolorPath(code: string): string {
  return finalPath(`base-recolor-${swatchCodeToSlug(code)}.png`);
}

export function cleanSwatchPath(kind: 'base' | 'grain' | 'mottle' | 'color-bias' | 'artifact-mask', code: string): string {
  return finalPath(`clean-swatch-${kind}-${swatchCodeToSlug(code)}.png`);
}

export function finalVariantPath(id: 'A' | 'B' | 'C', code: string): string {
  return finalPath(`final-variant-${id}-${swatchCodeToSlug(code)}.png`);
}

export function qaPath(kind: 'diff-vs-base' | 'diff-heatmap' | 'metrics', code: string): string {
  return finalPath(`qa-${kind}-${swatchCodeToSlug(code)}.${kind === 'metrics' ? 'json' : 'png'}`);
}

export function bestPreviewPath(code: string): string {
  return finalPath(`best-preview-master-${swatchCodeToSlug(code)}.png`);
}

export function bestComparisonPath(code: string): string {
  return finalPath(`best-preview-comparison-${swatchCodeToSlug(code)}.png`);
}

export function statusPath(code: string): string {
  return finalPath(`BEST_PREVIEW_STATUS-${swatchCodeToSlug(code)}.md`);
}

export function cleanupV2MasterPath(code: string): string {
  return finalPath(`best-preview-master-${swatchCodeToSlug(code)}-v2.png`);
}

export function cleanupV2ComparisonPath(code: string): string {
  return finalPath(`best-preview-comparison-${swatchCodeToSlug(code)}-v2.png`);
}

export function cleanupDebugBottomLinesPath(code: string): string {
  return finalPath(`cleanup-debug-bottom-lines.png`);
}

export function cleanupDebugLegZonesPath(code: string): string {
  return finalPath(`cleanup-debug-leg-zones.png`);
}

export function cleanupSpecV2Path(code: string): string {
  return finalPath(`cleanup-spec-v2.json`);
}

export function resolveSwatchImagePath(swatchFile: string): string {
  if (swatchFile.includes('/') || swatchFile.includes('\\')) {
    return join(REPO_ROOT, swatchFile);
  }
  return join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'swatches', swatchFile);
}

export const DEFAULT_SWATCH_CODE = 'BALI-SILK';
export const DEFAULT_SWATCH_FILE = BALI_SILK_SWATCH;

export { PRODUCT_CODE, PRODUCT_DIR, REPO_ROOT, SOURCE_OUT };
