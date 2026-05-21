import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, '..', '..');
export const PUBLIC_DIR = join(REPO_ROOT, 'public');
export const PRODUCT_ASSETS_DIR = join(PUBLIC_DIR, 'product-assets');
export const SWATCH_ASSETS_DIR = join(PUBLIC_DIR, 'swatch-assets');
export const RENDER_CACHE_DIR = join(PUBLIC_DIR, 'render-cache');

export function productDir(productCode: string): string {
  return join(PRODUCT_ASSETS_DIR, productCode);
}

export function productAssetsJsonPath(productCode: string): string {
  return join(productDir(productCode), 'assets.json');
}

export function toPublicUrl(absPath: string): string {
  const rel = absPath.replace(PUBLIC_DIR, '').replace(/\\/g, '/');
  return rel.startsWith('/') ? rel : `/${rel}`;
}
