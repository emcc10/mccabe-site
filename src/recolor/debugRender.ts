import { join, resolve } from 'path';
import sharp from 'sharp';
import type { RenderResult } from './types.js';
import { productDir } from './paths.js';
import { sourceImagePath } from './cache.js';
import { loadImageRGBA } from './imageIO.js';
import { loadMask } from './masks.js';
import { getSingleProductConfig } from './singleProductConfig.js';
import { getSwatchProfile } from './swatchRegistry.js';
import { recolorUpholstery } from './recolor.js';
import { compositeFinalRender } from './composite.js';
import { enforceLegExclusion } from './cleanup.js';
import { loadSingleProductAssets } from './productAssets.js';
import {
  productDebugDir,
  writeSideBySideComparison,
} from './debugAssets.js';
import {
  assertMasksValidForRecolor,
  formatMaskValidationReport,
} from './maskValidation.js';

export interface DebugSanityRenderResult {
  validationPassed: boolean;
  validationReport: string;
  finalDebugRender?: string;
  sideBySide?: string;
  render?: RenderResult;
}

export async function renderDebugSanitySwatch(
  productCode: string,
  swatchCode: string,
): Promise<DebugSanityRenderResult> {
  const assets = loadSingleProductAssets(productCode);
  if (!assets) throw new Error(`Missing assets.json for ${productCode}`);

  const basePath = resolve(sourceImagePath(productCode));
  const baseImage = await loadImageRGBA(basePath);
  const upholstery = await loadMask(join(productDir(productCode), 'upholstery-mask.png'));
  const legs = await loadMask(join(productDir(productCode), 'leg-mask.png'));
  const alpha = await loadMask(join(productDir(productCode), 'alpha.png'));
  const trim = await loadMask(join(productDir(productCode), 'trim-mask.png'));

  const validation = assertMasksValidForRecolor(alpha, upholstery, legs, trim);
  const report = formatMaskValidationReport(validation);

  const config = getSingleProductConfig(productCode);
  const swatch = getSwatchProfile(swatchCode);
  const debugDir = productDebugDir(productCode);

  const recolored = await recolorUpholstery(
    baseImage,
    assets,
    upholstery,
    swatch,
    config,
    'debug-flat-safe',
  );
  let finalImage = await compositeFinalRender(baseImage, recolored, assets);
  enforceLegExclusion(finalImage, baseImage, legs);

  const finalPath = join(debugDir, 'final-debug-render.png');
  await sharp(finalImage.data, {
    raw: {
      width: finalImage.width,
      height: finalImage.height,
      channels: finalImage.channels,
    },
  })
    .png()
    .toFile(finalPath);

  const sideBySidePath = join(debugDir, 'sanity-comparison.png');
  await writeSideBySideComparison(sideBySidePath, [
    { label: 'source', path: join(debugDir, 'source-preview.png') },
    { label: 'overlay', path: join(debugDir, 'combined-overlay-preview.png') },
    { label: 'render', path: finalPath },
  ]);

  return {
    validationPassed: true,
    validationReport: report,
    finalDebugRender: resolve(finalPath),
    sideBySide: resolve(sideBySidePath),
  };
}
