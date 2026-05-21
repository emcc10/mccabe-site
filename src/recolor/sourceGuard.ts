import { basename, resolve } from 'path';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { productDir } from './paths.js';

/** Path/name patterns that indicate a rendered swatch, not the cognac base photo */
const FORBIDDEN_SWATCH_PATTERNS = [
  /bali/i,
  /silk/i,
  /render-cache/i,
  /swatch/i,
  /-[a-f0-9]{8,}\.png$/i,
];

const ALLOWED_PRODUCT_FILES = new Set([
  'source.png',
  'alpha.png',
  'upholstery-mask.png',
  'leg-mask.png',
  'trim-mask.png',
  'shadow-map.png',
  'detail-map.png',
  'highlight-map.png',
  'assets.json',
  '.gitkeep',
]);

function looksLikeRenderedSwatchPath(absolutePath: string): boolean {
  const norm = resolve(absolutePath).replace(/\\/g, '/');
  const name = basename(absolutePath);
  for (const pat of FORBIDDEN_SWATCH_PATTERNS) {
    if (pat.test(norm) || pat.test(name)) return true;
  }
  return false;
}

/** Build step: reject render outputs; allow legacy cognac files (e.g. sofa.png) */
export function assertValidBuildInputPath(absolutePath: string, context: string): void {
  const norm = resolve(absolutePath).replace(/\\/g, '/').toLowerCase();

  if (norm.includes('/render-cache/')) {
    throw new Error(`${context}: build input cannot be under render-cache (${absolutePath})`);
  }
  if (norm.includes('/product-assets/') && !norm.endsWith('/source.png')) {
    throw new Error(
      `${context}: build input from product-assets must be an existing source.png copy target path, not "${basename(absolutePath)}" (${absolutePath})`,
    );
  }
  if (looksLikeRenderedSwatchPath(absolutePath)) {
    throw new Error(
      `${context}: path looks like a rendered swatch, not cognac source (${absolutePath})`,
    );
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`${context}: build input file does not exist (${absolutePath})`);
  }
}

/** Render step: base must be product-assets/.../source.png only */
export function assertValidRenderSourcePath(absolutePath: string, context: string): void {
  const norm = resolve(absolutePath).replace(/\\/g, '/').toLowerCase();
  const name = basename(absolutePath);

  if (!norm.endsWith('/source.png') || name !== 'source.png') {
    throw new Error(
      `${context}: render base must be source.png only, got "${name}" (${absolutePath})`,
    );
  }
  if (!norm.includes('/product-assets/')) {
    throw new Error(
      `${context}: render base must live under product-assets (${absolutePath})`,
    );
  }
  if (looksLikeRenderedSwatchPath(absolutePath)) {
    throw new Error(
      `${context}: path looks like a rendered swatch, not cognac source (${absolutePath})`,
    );
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`${context}: source file does not exist (${absolutePath})`);
  }
}

/** @deprecated Use assertValidRenderSourcePath or assertValidBuildInputPath */
export function assertValidSourceImagePath(absolutePath: string, context: string): void {
  assertValidRenderSourcePath(absolutePath, context);
}

/** Remove wrongly placed swatch renders from product-assets (never delete source/masks/maps). */
export function removeSwatchRendersFromProductDir(productCode: string): string[] {
  const dir = productDir(productCode);
  if (!existsSync(dir)) return [];
  const removed: string[] = [];
  for (const name of readdirSync(dir)) {
    if (ALLOWED_PRODUCT_FILES.has(name)) continue;
    if (name.endsWith('.override.png')) continue;
    if (!name.toLowerCase().endsWith('.png')) continue;
    const full = resolve(dir, name);
    unlinkSync(full);
    removed.push(full);
  }
  return removed;
}

export function assertBaseImageUrlInAssets(baseImageUrl: string, productCode: string): void {
  const expected = `/product-assets/${productCode}/source.png`;
  if (baseImageUrl !== expected && !baseImageUrl.endsWith(`/${productCode}/source.png`)) {
    throw new Error(`assets.json baseImageUrl must point to source.png only, got "${baseImageUrl}"`);
  }
}
