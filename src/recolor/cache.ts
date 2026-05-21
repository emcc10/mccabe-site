import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
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
