import { join } from 'path';
import { DEBUG_DIR } from '../phase1/paths.js';

export const PHASE2_RECOLOR_OUT = join(DEBUG_DIR, 'phase2-bali-silk.png');
export const PHASE2_COMPARISON_OUT = join(DEBUG_DIR, 'phase2-comparison.png');

/** Bali Silk — upholstery a/b target only; L comes from source */
export const BALI_SILK_LAB = { l: 74.2, a: 1.8, b: 11.4 };
export const PRESERVE_LUMINANCE = 0.93;
export const CHROMA_BLEND = 0.28;
