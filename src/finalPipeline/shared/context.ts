import type { Mask } from '../../phase1/masks.js';
import type { RgbaImage } from '../../phase1/segment.js';
import type { RelativeLRemapParams } from '../../phase4/recolor.js';
import { computeUpholsteryLabStats } from '../../phase4/recolor.js';
import { buildBaseRecolor } from '../baseRecolor.js';
import { runPrep, type PrepResult } from '../prep.js';
import { runSwatchClean, type SwatchCleanResult } from '../swatchClean.js';
import { getSwatchProfile } from '../swatchProfiles.js';
import type { SwatchProfile } from '../spec.js';

/** Product-fixed assets shared by preview and hero pipelines. */
export interface SharedRenderContext {
  profile: SwatchProfile;
  prep: PrepResult;
  base: {
    image: RgbaImage;
    path: string;
    params: RelativeLRemapParams;
    labStats: ReturnType<typeof computeUpholsteryLabStats>;
  };
  swatch: SwatchCleanResult;
  /** Convenience accessors */
  source: RgbaImage;
  alpha: Mask;
  upholstery: Mask;
  legs: Mask;
}

/**
 * Stages 1–3 shared by both pipelines: prep, swatch-driven base recolor, clean swatch maps.
 * Same geometry, masks, and profile for every leather on this product.
 */
export async function buildSharedRenderContext(swatchCode: string): Promise<SharedRenderContext> {
  const profile = getSwatchProfile(swatchCode);
  const prep = await runPrep();
  const base = await buildBaseRecolor(profile);
  const swatch = await runSwatchClean(profile);
  return {
    profile,
    prep,
    base,
    swatch,
    source: prep.source,
    alpha: prep.alpha,
    upholstery: prep.upholstery,
    legs: prep.legs,
  };
}
