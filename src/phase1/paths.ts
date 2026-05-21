import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(HERE, '..', '..');
export const PRODUCT_CODE = 'TEST-SOFA';
export const PRODUCT_DIR = join(REPO_ROOT, 'public', 'product-assets', PRODUCT_CODE);
export const DEBUG_DIR = join(PRODUCT_DIR, 'debug');

export const LEGACY_SOURCE = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'sofa.png');
export const LEGACY_UPHOLSTERY_MASK = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'mask.png');

export const SOURCE_OUT = join(PRODUCT_DIR, 'source.png');
export const ALPHA_PREVIEW = join(DEBUG_DIR, 'alpha-preview.png');
export const UPHOLSTERY_MASK_PREVIEW = join(DEBUG_DIR, 'upholstery-mask-preview.png');
export const LEG_MASK_PREVIEW = join(DEBUG_DIR, 'leg-mask-preview.png');
export const COMBINED_OVERLAY_PREVIEW = join(DEBUG_DIR, 'combined-overlay-preview.png');
