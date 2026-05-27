/**
 * Product render entrypoints.
 *
 * - Preview: deterministic, reusable, fast (permanent batch system)
 * - Hero: optional generative upholstery realism (separate path)
 */

export { buildSharedRenderContext } from './shared/context.js';
export type { SharedRenderContext } from './shared/context.js';

export { runPreviewPipeline } from './preview/runPreview.js';
export type { RunPreviewOptions } from './preview/runPreview.js';
export { buildPreviewExportManifest } from './preview/exportPreview.js';
export type { PreviewExportManifest } from './preview/exportPreview.js';

export { runHeroPipeline } from './hero/runHero.js';
export type { RunHeroOptions } from './hero/runHero.js';
export { buildHeroExportManifest } from './hero/exportHero.js';
export type { HeroExportManifest, HeroPipelineResult } from './hero/spec.js';

/** @deprecated Use runPreviewPipeline */
export { runPreviewPipeline as runFinalPipeline } from './preview/runPreview.js';
