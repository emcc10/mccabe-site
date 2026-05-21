/**
 * TEMPORARY: exaggerated source-photo realism — must visibly change export if pipeline works.
 * No luma lock, no mean normalize, no reference transfer, no smoothing.
 */
import { prepareSourceLLfBand } from './leather-detail.js';
import { labToRgb } from './render-sofas.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Intentionally extreme — debug only. */
export const PROBE_L_STRUCTURE = 1.12;
export const PROBE_HF_GAIN = 3.6;
export const PROBE_MF_GAIN = 2.4;
export const PROBE_LF_GAIN = 1.1;
export const PROBE_LF_RADIUS = 6;

/**
 * Source photo L + max HF/MF/LF grain, Bali chroma only. No Rec.709 luma ratio (no flattening).
 */
export function baliRealismProbeRgb(r, g, b, chroma, grain, j, photoL, meanPhotoL, anchorL, sourceLf) {
  let finalL = photoL + (anchorL - meanPhotoL) * PROBE_L_STRUCTURE;
  finalL +=
    grain.sourceHf[j] * PROBE_HF_GAIN +
    grain.sourceMf[j] * PROBE_MF_GAIN +
    (sourceLf?.[j] ?? 0) * PROBE_LF_GAIN;
  finalL = clamp(finalL, 0, 100);
  const { r: tr, g: tg, b: tb } = labToRgb(finalL, chroma.a, chroma.b);
  return { r: tr, g: tg, b: tb };
}
