import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import sharp from 'sharp';
import type { ProductRenderAssets, RenderRequest, RenderResult } from './types.js';
import { productDir, toPublicUrl } from './paths.js';
import { loadSingleProductAssets, saveSingleProductAssets, createEmptyAssetsRecord } from './productAssets.js';
import { getSingleProductConfig } from './singleProductConfig.js';
import { getSwatchProfile } from './swatchRegistry.js';
import { buildSegmentationForProduct } from './segment.js';
import { saveDerivedMaps } from './maps.js';
import { loadImageRGBA } from './imageIO.js';
import { recolorUpholstery } from './recolor.js';
import { compositeFinalRender } from './composite.js';
import { enforceLegExclusion, removeStrayBaseArtifacts } from './cleanup.js';
import { runRenderQA } from './qa.js';
import {
  assertBaseImageUrlInAssets,
  assertValidSourceImagePath,
} from './sourceGuard.js';
import {
  assetVersionFromRecord,
  buildCacheKey,
  getCachedRender,
  getCachedRenderPath,
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
  const srcPath = resolve(sourceImagePath(productCode));
  assertValidSourceImagePath(srcPath, 'ensureProductAssets');

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
    assets.baseImageUrl = `/product-assets/${productCode}/source.png`;
    assets.alphaMaskUrl = toPublicUrl(join(productDir(productCode), 'alpha.png'));
    assets.upholsteryMaskUrl = toPublicUrl(join(productDir(productCode), 'upholstery-mask.png'));
    assets.legMaskUrl = toPublicUrl(join(productDir(productCode), 'leg-mask.png'));
    assets.trimMaskUrl = toPublicUrl(join(productDir(productCode), 'trim-mask.png'));
    assets.shadowMapUrl = toPublicUrl(mapPaths.shadowPath);
    assets.detailMapUrl = toPublicUrl(mapPaths.detailPath);
    assets.highlightMapUrl = toPublicUrl(mapPaths.highlightPath);
    assertBaseImageUrlInAssets(assets.baseImageUrl, productCode);
    saveSingleProductAssets(assets);
  }

  assets = loadSingleProductAssets(productCode)!;
  assertBaseImageUrlInAssets(assets.baseImageUrl, productCode);
  return assets;
}

export async function renderProductSwatch(request: RenderRequest): Promise<RenderResult> {
  const { productCode, swatchCode, forceRebuild } = request;
  const assets = await ensureProductAssets(productCode, false);
  const version = assetVersionFromRecord(assets);
  const cacheKey = buildCacheKey(productCode, swatchCode, version);
  const cachePath = resolve(getCachedRenderPath(productCode, swatchCode, cacheKey));
  const basePath = resolve(sourceImagePath(productCode));

  assertValidSourceImagePath(basePath, 'renderProductSwatch');
  console.log(`[render] source (cognac base only): ${basePath}`);

  if (!forceRebuild) {
    const cached = getCachedRender(cachePath);
    if (cached) {
      console.log(`[render] output (cached): ${cachePath}`);
      return {
        imageUrl: publicRenderUrl(productCode, swatchCode, cacheKey),
        outputPath: cachePath,
        sourcePath: basePath,
        cacheKey,
        productCode,
        swatchCode,
        segmentationApproved: assets.segmentationApproved,
      };
    }
  }

  const config = getSingleProductConfig(productCode);
  const swatch = getSwatchProfile(swatchCode);
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
  console.log(`[render] output: ${cachePath}`);

  return {
    imageUrl: publicRenderUrl(productCode, swatchCode, cacheKey),
    outputPath: cachePath,
    sourcePath: basePath,
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
): { sourcePath: string; maskOverridePath?: string } {
  assertValidSourceImagePath(resolve(legacySourcePath), 'bootstrap input');

  const dir = productDir(productCode);
  mkdirSync(dir, { recursive: true });
  const destSource = join(dir, 'source.png');
  copyFileSync(legacySourcePath, destSource);
  assertValidSourceImagePath(resolve(destSource), 'bootstrap output source.png');

  let maskOverridePath: string | undefined;
  if (legacyMaskPath && existsSync(legacyMaskPath)) {
    maskOverridePath = join(dir, 'upholstery-mask.override.png');
    copyFileSync(legacyMaskPath, maskOverridePath);
    console.log(`  override mask: ${maskOverridePath}`);
  }
  return { sourcePath: resolve(destSource), maskOverridePath };
}
