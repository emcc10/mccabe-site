import type { SharedRenderContext } from '../shared/context.js';
import { baseRecolorPath } from '../paths.js';
import {
  heroComparisonPath,
  heroInputBundleDir,
  heroMasterPath,
  heroStatusPath,
  previewExportPath,
} from '../shared/paths.js';
import type { HeroExportManifest, HeroPipelineResult } from './spec.js';

export function buildHeroExportManifest(
  ctx: SharedRenderContext,
  result: HeroPipelineResult,
): HeroExportManifest {
  return {
    swatchCode: ctx.profile.code,
    heroMaster: result.outputs.heroMaster,
    heroComparison: result.outputs.heroComparison,
    inputBundleDir: result.inputBundle.paths.bundleDir,
    status: result.outputs.status,
    previewBaseRecolor: ctx.base.path || baseRecolorPath(ctx.profile.code),
  };
}

export function heroExportDestPath(code: string): string {
  return heroMasterPath(code);
}

/** Suggested preview path for side-by-side hero comparison grids */
export function heroVsPreviewComparisonHint(code: string): {
  preview: string;
  hero: string;
} {
  return {
    preview: previewExportPath(code),
    hero: heroMasterPath(code),
  };
}
