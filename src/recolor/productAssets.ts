import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ProductRenderAssets } from './types.js';
import { productAssetsJsonPath, productDir, toPublicUrl } from './paths.js';

export function loadSingleProductAssets(productCode: string): ProductRenderAssets | null {
  const p = productAssetsJsonPath(productCode);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as ProductRenderAssets;
}

export function saveSingleProductAssets(record: ProductRenderAssets): void {
  const dir = productDir(record.productCode);
  mkdirSync(dir, { recursive: true });
  record.updatedAt = new Date().toISOString();
  writeFileSync(productAssetsJsonPath(record.productCode), JSON.stringify(record, null, 2));
}

export function createEmptyAssetsRecord(productCode: string, sourceFileName = 'source.png'): ProductRenderAssets {
  const dir = productDir(productCode);
  return {
    productCode,
    baseImageUrl: toPublicUrl(join(dir, sourceFileName)),
    segmentationApproved: false,
    updatedAt: new Date().toISOString(),
  };
}
