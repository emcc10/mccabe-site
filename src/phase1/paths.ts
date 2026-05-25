import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(HERE, '..', '..');
export const PRODUCT_CODE = 'TEST-SOFA';
export const PRODUCT_DIR = join(REPO_ROOT, 'public', 'product-assets', PRODUCT_CODE);
export const DEBUG_DIR = join(PRODUCT_DIR, 'debug');

/** Frozen preview render + params (7C-B). Not final catalog photo quality. */
export const PREVIEW_LOCKED_DIR = join(PRODUCT_DIR, 'preview-locked');
export const PREVIEW_LOCKED_IMAGE = join(PREVIEW_LOCKED_DIR, 'bali-silk-preview.png');
export const PREVIEW_LOCKED_PARAMS = join(PREVIEW_LOCKED_DIR, 'params.json');
export const PREVIEW_LOCKED_STATUS = join(PREVIEW_LOCKED_DIR, 'STATUS.md');

/** Locked RealLeather production baseline (FINAL-A). */
export const REALLEATHER_LOCKED_DIR = join(PRODUCT_DIR, 'realleather-locked');
export const REALLEATHER_LOCKED_IMAGE = join(REALLEATHER_LOCKED_DIR, 'bali-silk-realleather-baseline.png');
export const REALLEATHER_LOCKED_PARAMS = join(REALLEATHER_LOCKED_DIR, 'params.json');
export const REALLEATHER_LOCKED_STATUS = join(REALLEATHER_LOCKED_DIR, 'STATUS.md');

export const LEGACY_SOURCE = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'sofa.png');
export const LEGACY_UPHOLSTERY_MASK = join(REPO_ROOT, 'sofa-recolor-tool', 'input', 'mask.png');
/** Hand-edited leg mask (white = legs). Your approved leg-mask-preview. */
export const LEG_MASK_OVERRIDE = join(PRODUCT_DIR, 'leg-mask.override.png');

export const SOURCE_OUT = join(PRODUCT_DIR, 'source.png');

/** Physical Bali Silk swatch photo (material source for Phase 9). */
export const BALI_SILK_SWATCH = join(
  REPO_ROOT,
  'sofa-recolor-tool',
  'input',
  'swatches',
  'Bali-Silk.jpg',
);
export const ALPHA_PREVIEW = join(DEBUG_DIR, 'alpha-preview.png');
export const UPHOLSTERY_MASK_PREVIEW = join(DEBUG_DIR, 'upholstery-mask-preview.png');
export const LEG_MASK_PREVIEW = join(DEBUG_DIR, 'leg-mask-preview.png');
export const COMBINED_OVERLAY_PREVIEW = join(DEBUG_DIR, 'combined-overlay-preview.png');
