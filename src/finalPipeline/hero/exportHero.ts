import type { SharedRenderContext } from '../shared/context.js';
import { baseRecolorPath } from '../paths.js';
import { heroVariantPath, previewExportPath } from '../shared/paths.js';
import type { HeroExportManifest, HeroPipelineResult } from './spec.js';

export function buildHeroExportManifest(
  ctx: SharedRenderContext,
  result: HeroPipelineResult,
): HeroExportManifest {
  return {
    swatchCode: ctx.profile.code,
    heroMaster: result.outputs.bestMaster,
    heroComparison: result.outputs.grid,
    heroVariantA: result.outputs.variantPaths.A,
    heroVariantB: result.outputs.variantPaths.B,
    heroGrid: result.outputs.grid,
    heroSpec: result.outputs.spec,
    inputBundleDir: result.inputBundle.paths.bundleDir,
    status: result.outputs.status,
    previewBaseRecolor: ctx.base.path || baseRecolorPath(ctx.profile.code),
    bestVariantId: result.bestVariantId,
  };
}

export function heroExportDestPath(code: string): string {
  return heroVariantPath('B', code);
}

/** Suggested preview path for side-by-side hero comparison grids */
export function heroVsPreviewComparisonHint(code: string): {
  preview: string;
  hero: string;
} {
  return {
    preview: previewExportPath(code),
    hero: heroVariantPath('B', code),
  };
}
