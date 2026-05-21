import type { Mask } from '../phase1/masks.js';
import { dilate, erode, intersect, subtract, union } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import type { RelativeLRemapParams, UpholsteryLabStats } from '../phase4/recolor.js';
import { recolorUpholsteryRelativeLRemap } from '../phase4/recolor.js';

const EDGE_EXPAND_PX = 1;
const FOOT_GUARD_PX = 1;

export interface Stage4bCoverageMasks {
  /** Alpha silhouette outer 1px + 1px upholstery expand inside alpha, non-leg */
  upholsteryEdgeBand: Mask;
  /** Band pixels added beyond core upholstery (for debug preview) */
  edgeBandOnly: Mask;
  /** dilate(legs,1) ∩ alpha − legs */
  footRing: Mask;
  /** Core upholstery ∪ edge band ∪ foot ring — recolor + composite upholstery */
  upholsteryRecolor: Mask;
}

export function buildStage4bCoverageMasks(
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
): Stage4bCoverageMasks {
  const nonLeg = subtract(alpha, legs);
  const alphaContour = subtract(alpha, erode(alpha, EDGE_EXPAND_PX));
  const expandInsideAlpha = subtract(intersect(dilate(upholstery, EDGE_EXPAND_PX), alpha), upholstery);
  const upholsteryEdgeBand = intersect(union(alphaContour, expandInsideAlpha), nonLeg);
  const edgeBandOnly = subtract(upholsteryEdgeBand, upholstery);
  const legGuard = subtract(intersect(dilate(legs, FOOT_GUARD_PX), alpha), legs);
  const footJunction = subtract(
    intersect(dilate(upholstery, FOOT_GUARD_PX), dilate(legs, FOOT_GUARD_PX)),
    legs,
  );
  const footRing = intersect(union(legGuard, footJunction), nonLeg);
  const upholsteryRecolor = union(upholstery, upholsteryEdgeBand, footRing);

  return { upholsteryEdgeBand, edgeBandOnly, footRing, upholsteryRecolor };
}

export function recolorWithStage4bCoverage(
  source: RgbaImage,
  upholstery: Mask,
  alpha: Mask,
  legs: Mask,
  params: RelativeLRemapParams,
  stats: UpholsteryLabStats,
) {
  const masks = buildStage4bCoverageMasks(alpha, upholstery, legs);
  const { image: recolored } = recolorUpholsteryRelativeLRemap(
    source,
    masks.upholsteryRecolor,
    params,
    stats,
  );
  return { recolored, masks };
}

/** Overlay band mask on source for debug (magenta = edge band, cyan = foot ring). */
export function buildCoveragePreviewRgb(
  source: RgbaImage,
  edgeBandOnly: Mask,
  footRing: Mask,
): Buffer {
  const { width, height, channels } = source;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = source.data[p];
    let g = source.data[p + 1];
    let b = source.data[p + 2];
    if (edgeBandOnly.data[j] >= 128) {
      r = Math.round(r * 0.4 + 255 * 0.6);
      g = Math.round(g * 0.4 + 60 * 0.6);
      b = Math.round(b * 0.4 + 255 * 0.6);
    } else if (footRing.data[j] >= 128) {
      r = Math.round(r * 0.4 + 40 * 0.6);
      g = Math.round(g * 0.4 + 220 * 0.6);
      b = Math.round(b * 0.4 + 255 * 0.6);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

export function buildEdgeBandPreviewRgb(source: RgbaImage, edgeBandOnly: Mask): Buffer {
  const { width, height, channels } = source;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = source.data[p];
    let g = source.data[p + 1];
    let b = source.data[p + 2];
    if (edgeBandOnly.data[j] >= 128) {
      r = Math.round(r * 0.35 + 255 * 0.65);
      g = Math.round(g * 0.35 + 50 * 0.65);
      b = Math.round(b * 0.35 + 255 * 0.65);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

export function buildFootRingPreviewRgb(source: RgbaImage, footRing: Mask): Buffer {
  const { width, height, channels } = source;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = source.data[p];
    let g = source.data[p + 1];
    let b = source.data[p + 2];
    if (footRing.data[j] >= 128) {
      r = Math.round(r * 0.35 + 40 * 0.65);
      g = Math.round(g * 0.35 + 220 * 0.65);
      b = Math.round(b * 0.35 + 255 * 0.65);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

/** Pixels in edge/foot bands where final RGB still matches source (should be 0). */
export function countBandSourceRgbSurvivors(
  source: RgbaImage,
  final: RgbaImage,
  legs: Mask,
  edgeBandOnly: Mask,
  footRing: Mask,
  tolerance = 2,
): number {
  const { channels } = source;
  let n = 0;
  for (let j = 0; j < source.data.length / channels; j++) {
    if (legs.data[j] >= 128) continue;
    if (edgeBandOnly.data[j] < 128 && footRing.data[j] < 128) continue;
    const p = j * channels;
    if (
      Math.abs(source.data[p] - final.data[p]) <= tolerance &&
      Math.abs(source.data[p + 1] - final.data[p + 1]) <= tolerance &&
      Math.abs(source.data[p + 2] - final.data[p + 2]) <= tolerance
    ) {
      n++;
    }
  }
  return n;
}

/**
 * After compositePhase2: force recolored RGB on edge/foot bands (non-leg, alpha on).
 * Legs stay source; alpha channel untouched.
 */
export function applyCoverageBandsToFinal(
  source: RgbaImage,
  recolored: RgbaImage,
  final: RgbaImage,
  alpha: Mask,
  legs: Mask,
  edgeBandOnly: Mask,
  footRing: Mask,
): void {
  const { channels } = source;
  for (let j = 0; j < alpha.data.length; j++) {
    if (legs.data[j] >= 128) continue;
    if (edgeBandOnly.data[j] < 128 && footRing.data[j] < 128) continue;
    if (alpha.data[j] < 128) continue;
    const p = j * channels;
    final.data[p] = recolored.data[p];
    final.data[p + 1] = recolored.data[p + 1];
    final.data[p + 2] = recolored.data[p + 2];
  }
}
