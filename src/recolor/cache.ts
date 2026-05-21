import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import type { ProductRenderAssets } from './types.js';
import { RENDER_CACHE_DIR, productDir } from './paths.js';

export function buildCacheKey(
  productCode: string,
  swatchCode: string,
  assetVersion: string,
): string {
  const raw = `${productCode}|${swatchCode}|${assetVersion}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export function getCachedRenderPath(
  productCode: string,
  swatchCode: string,
  cacheKey: string,
): string {
  const dir = join(RENDER_CACHE_DIR, productCode);
  mkdirSync(dir, { recursive: true });
  return join(dir, `${swatchCode}-${cacheKey}.png`);
}

export function getCachedRender(cacheKeyPath: string): Buffer | null {
  if (!existsSync(cacheKeyPath)) return null;
  return readFileSync(cacheKeyPath);
}

export function saveCachedRender(cacheKeyPath: string, imageBuffer: Buffer): void {
  mkdirSync(join(cacheKeyPath, '..'), { recursive: true });
  writeFileSync(cacheKeyPath, imageBuffer);
}

export function assetVersionFromRecord(assets: ProductRenderAssets): string {
  return assets.updatedAt;
}

export function publicRenderUrl(productCode: string, swatchCode: string, cacheKey: string): string {
  return `/render-cache/${productCode}/${swatchCode}-${cacheKey}.png`;
}

export function sourceImagePath(productCode: string): string {
  return join(productDir(productCode), 'source.png');
}

export interface RenderCacheManifestEntry {
  swatchCode: string;
  label: string;
  imageUrl: string;
  outputPath: string;
  cacheKey: string;
  updatedAt: string;
}

export interface RenderCacheManifest {
  productCode: string;
  baseImageUrl: string;
  renders: Record<string, RenderCacheManifestEntry>;
}

export function renderManifestPath(productCode: string): string {
  return join(RENDER_CACHE_DIR, productCode, 'manifest.json');
}

/** Stable index so previews can find hashed PNGs without guessing filenames */
export function updateRenderManifest(
  productCode: string,
  entry: RenderCacheManifestEntry,
  baseImageUrl: string,
): string {
  const path = renderManifestPath(productCode);
  mkdirSync(join(path, '..'), { recursive: true });
  let manifest: RenderCacheManifest = {
    productCode,
    baseImageUrl,
    renders: {},
  };
  if (existsSync(path)) {
    manifest = JSON.parse(readFileSync(path, 'utf8')) as RenderCacheManifest;
  }
  manifest.renders[entry.swatchCode] = entry;
  writeFileSync(path, JSON.stringify(manifest, null, 2));
  return resolve(path);
}
