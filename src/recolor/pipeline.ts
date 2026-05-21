import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import type { ProductRenderAssets, RenderRequest, RenderResult } from './types.js';
import { productDir, toPublicUrl } from './paths.js';
import { loadSingleProductAssets, saveSingleProductAssets, createEmptyAssetsRecord } from './productAssets.js';
import { getSingleProductConfig } from './singleProductConfig.js';
import { getSwatchProfile } from './swatchRegistry.js';
import { buildSegmentationForProduct } from './segment.js';
import { saveDerivedMaps } from './maps.js';
import { loadImageRGBA, saveImageRGBA } from './imageIO.js';
import { recolorUpholstery } from './recolor.js';
import { compositeFinalRender } from './composite.js';
import { enforceLegExclusion, removeStrayBaseArtifacts } from './cleanup.js';
import { runRenderQA } from './qa.js';
import {
  assetVersionFromRecord,
  buildCacheKey,
  getCachedRender,
  getCachedRenderPath,
  getLatestRenderCachePath,
  getProductAssetRenderPath,
  publicProductRenderUrl,
  publicRenderUrl,
  saveCachedRender,
  sourceImagePath,
} from './cache.js';
import { loadMask, maskBoundingBox } from './masks.js';

export async function ensureProductAssets(
  productCode: string,
  forceRebuild = false,
): Promise<ProductRenderAssets> {
  const config = getSingleProductConfig(productCode);
  let assets = loadSingleProductAssets(productCode);
  const srcPath = sourceImagePath(productCode);

  if (!existsSync(srcPath)) {
    throw new Error(`Missing source image: ${srcPath}. Run buildSingleProductAssets first.`);
  }

  const needsBuild =
    forceRebuild ||
    !assets ||
    !assets.upholsteryMaskUrl ||
    !existsSync(join(productDir(productCode), 'upholstery-mask.png'));

  if (needsBuild) {
    const image = await loadImageRGBA(srcPath);
    const seg = await buildSegmentationForProduct(productCode, srcPath, config);
    const mapPaths = await saveDerivedMaps(productCode, image, seg.upholstery);
    assets = assets ?? createEmptyAssetsRecord(productCode);
    assets.baseImageUrl = toPublicUrl(srcPath);
    assets.alphaMaskUrl = toPublicUrl(join(productDir(productCode), 'alpha.png'));
    assets.upholsteryMaskUrl = toPublicUrl(join(productDir(productCode), 'upholstery-mask.png'));
    assets.legMaskUrl = toPublicUrl(join(productDir(productCode), 'leg-mask.png'));
    assets.trimMaskUrl = toPublicUrl(join(productDir(productCode), 'trim-mask.png'));
    assets.shadowMapUrl = toPublicUrl(mapPaths.shadowPath);
    assets.detailMapUrl = toPublicUrl(mapPaths.detailPath);
    assets.highlightMapUrl = toPublicUrl(mapPaths.highlightPath);
    saveSingleProductAssets(assets);
  }

  return loadSingleProductAssets(productCode)!;
}

export async function renderProductSwatch(request: RenderRequest): Promise<RenderResult> {
  const { productCode, swatchCode, forceRebuild } = request;
  const assets = await ensureProductAssets(productCode, forceRebuild);
  const version = assetVersionFromRecord(assets);
  const cacheKey = buildCacheKey(productCode, swatchCode, version);
  const cachePath = getCachedRenderPath(productCode, swatchCode, cacheKey);
  const productRenderPath = getProductAssetRenderPath(productCode, swatchCode);
  const latestCachePath = getLatestRenderCachePath(productCode, swatchCode);

  if (!forceRebuild) {
    const cached = getCachedRender(cachePath);
    if (cached) {
      writeFileSync(productRenderPath, cached);
      writeFileSync(latestCachePath, cached);
      return {
        imageUrl: publicRenderUrl(productCode, swatchCode, cacheKey),
        productAssetPath: productRenderPath,
        cacheKey,
        productCode,
        swatchCode,
        segmentationApproved: assets.segmentationApproved,
      };
    }
  }

  const config = getSingleProductConfig(productCode);
  const swatch = getSwatchProfile(swatchCode);
  const basePath = sourceImagePath(productCode);
  const baseImage = await loadImageRGBA(basePath);
  const upholstery = await loadMask(join(productDir(productCode), 'upholstery-mask.png'));
  const legs = await loadMask(join(productDir(productCode), 'leg-mask.png'));
  const alpha = await loadMask(join(productDir(productCode), 'alpha.png'));

  const recolored = await recolorUpholstery(baseImage, assets, upholstery, swatch, config);
  let finalImage = await compositeFinalRender(baseImage, recolored, assets);

  enforceLegExclusion(finalImage, baseImage, legs);
  const bb = maskBoundingBox(alpha);
  if (bb) removeStrayBaseArtifacts(finalImage, alpha, bb.maxY);

  const qa = await runRenderQA(baseImage, finalImage, assets);
  console.log('[QA]', JSON.stringify(qa, null, 2));

  const pngBuf = await sharp(finalImage.data, {
    raw: { width: finalImage.width, height: finalImage.height, channels: finalImage.channels },
  })
    .png()
    .toBuffer();

  saveCachedRender(cachePath, pngBuf);
  saveCachedRender(latestCachePath, pngBuf);
  saveCachedRender(productRenderPath, pngBuf);

  return {
    imageUrl: publicRenderUrl(productCode, swatchCode, cacheKey),
    productAssetPath: productRenderPath,
    cacheKey,
    productCode,
    swatchCode,
    segmentationApproved: assets.segmentationApproved,
  };
}

export function bootstrapFromLegacySofaTool(
  productCode: string,
  legacySourcePath: string,
  legacyMaskPath?: string,
): void {
  const dir = productDir(productCode);
  mkdirSync(dir, { recursive: true });
  copyFileSync(legacySourcePath, join(dir, 'source.png'));
  if (legacyMaskPath && existsSync(legacyMaskPath)) {
    copyFileSync(legacyMaskPath, join(dir, 'upholstery-mask.override.png'));
    console.log(`Using override upholstery mask from ${legacyMaskPath}`);
  }
}
