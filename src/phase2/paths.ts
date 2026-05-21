import { join } from 'path';
import { DEBUG_DIR, COMBINED_OVERLAY_PREVIEW } from '../phase1/paths.js';

export const PHASE2_RECOLOR_OUT = join(DEBUG_DIR, 'phase2-bali-silk.png');
export const PHASE2_COMPARISON_OUT = join(DEBUG_DIR, 'phase2-comparison.png');
export const PHASE2_SPEC_OUT = join(DEBUG_DIR, 'stage2-spec.json');
export const PHASE2_METRICS_OUT = join(DEBUG_DIR, 'stage2-structural-metrics.json');

export { COMBINED_OVERLAY_PREVIEW };

export {
  BALI_SILK_LAB,
  PRESERVE_LUMINANCE,
  CHROMA_BLEND,
  TEXTURE_DETAIL_CONTRIBUTION,
  HIGHLIGHT_COMPRESSION,
  stage2SpecRecord,
} from './spec.js';
