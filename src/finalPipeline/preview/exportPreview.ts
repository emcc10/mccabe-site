import {
  baseRecolorPath,
  bestComparisonPath,
  bestPreviewPath,
  cleanSwatchPath,
  finalPath,
  statusPath,
} from '../paths.js';
import type { PreviewPipelineResult } from '../spec.js';
import type { SharedRenderContext } from '../shared/context.js';
import { previewExportPath as previewExportDestPath } from '../shared/paths.js';

/** Canonical preview export manifest (deterministic pipeline). */
export interface PreviewExportManifest {
  swatchCode: string;
  /** Primary catalog / PLP preview image */
  previewMaster: string;
  /** base recolor vs preview master */
  previewComparison: string;
  /** Locked base recolor (color family, no material pass) */
  baseRecolor: string;
  prep: SharedRenderContext['prep']['paths'];
  swatchMaps: {
    cleanBase: string;
    cleanGrain: string;
    cleanMottle: string;
    cleanColorBias: string;
    cleanArtifactMask: string;
  };
  status: string;
  qaMetrics: string;
  optional: {
    grid?: string;
    regionDebug?: string;
    variants?: { id: string; path: string }[];
  };
}

export function buildPreviewExportManifest(
  ctx: SharedRenderContext,
  result?: PreviewPipelineResult,
): PreviewExportManifest {
  const code = ctx.profile.code;
  return {
    swatchCode: code,
    previewMaster: result?.outputs.bestMaster || bestPreviewPath(code),
    previewComparison: result?.outputs.bestComparison || bestComparisonPath(code),
    baseRecolor: result?.baseRecolor || baseRecolorPath(code),
    prep: result?.prep || ctx.prep.paths,
    swatchMaps: result?.swatchOutputs || ctx.swatch.paths,
    status: result?.outputs.status || statusPath(code),
    qaMetrics: result?.outputs.qaMetrics || finalPath(`qa-metrics-${code.toUpperCase().replace(/\s+/g, '-')}.json`),
    optional: result
      ? {
          grid: result.outputs.grid,
          regionDebug: result.regionDebug,
          variants: result.variants.map((v) => ({ id: v.id, path: v.path })),
        }
      : undefined,
  };
}

export { previewExportDestPath };
