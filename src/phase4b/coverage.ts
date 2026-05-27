import type { Mask } from '../phase1/masks.js';
import { dilate, erode, intersect, subtract, union } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import type { RelativeLRemapParams, UpholsteryLabStats } from '../phase4/recolor.js';
import { recolorUpholsteryRelativeLRemap, relativeLRemapRgb } from '../phase4/recolor.js';
import { labToRgb, rgbToLab } from '../phase5/labUtil.js';

/** Thin boundary rings only (v3) — no blobs or rectangular fills */
const EDGE_EXPAND_PX = 1;
const LEG_RING_PX = 1;
const CONTOUR_RING_PX = 1;
const UPHOLSTERY_NEAR_PX = 2;
/** Upholstery ring above/beside feet — full Bali Silk ownership (no cognac source) */
const FOOT_ADJ_OUTER_PX = 11;
const FOOT_ADJ_INNER_PX = 1;
const FOOT_ADJ_UPHOL_DILATE = 5;

export interface Stage4bCoverageMasks {
  /** 1px upholstery expand inside alpha (recovers mask erode) */
  edgeBandOnly: Mask;
  /** dilate(leg,1) ∩ alpha ∩ non-leg ∩ upholstery-neighborhood */
  footCornerRing: Mask;
  /** Wider upholstery-only ring at feet for full chroma recolor */
  footAdjacentUpholstery: Mask;
  /** Outer alpha silhouette 1px ring */
  contourRing: Mask;
  /** All thin cleanup rings combined */
  cleanupUnion: Mask;
  upholsteryRecolor: Mask;
}

export function buildStage4bCoverageMasks(
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
): Stage4bCoverageMasks {
  const nonLeg = intersect(subtract(alpha, legs), alpha);
  const upholsteryNear = intersect(dilate(upholstery, UPHOLSTERY_NEAR_PX), alpha);

  const edgeBandOnly = intersect(
    subtract(intersect(dilate(upholstery, EDGE_EXPAND_PX), alpha), upholstery),
    nonLeg,
  );

  const contourRing = intersect(subtract(alpha, erode(alpha, CONTOUR_RING_PX)), nonLeg);

  const footCornerRing = intersect(
    subtract(intersect(dilate(legs, LEG_RING_PX), alpha), legs),
    intersect(upholsteryNear, nonLeg),
  );

  const footAdjacentUpholstery = intersect(
    subtract(dilate(legs, FOOT_ADJ_OUTER_PX), dilate(legs, FOOT_ADJ_INNER_PX)),
    intersect(dilate(upholstery, FOOT_ADJ_UPHOL_DILATE), alpha),
  );

  const cleanupUnion = union(edgeBandOnly, footCornerRing, footAdjacentUpholstery, contourRing);
  const upholsteryRecolor = union(upholstery, cleanupUnion);

  return {
    edgeBandOnly,
    footCornerRing,
    footAdjacentUpholstery,
    contourRing,
    cleanupUnion,
    upholsteryRecolor,
  };
}

export function countMaskPixelsOutsideAlpha(mask: Mask, alpha: Mask): number {
  let n = 0;
  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] >= 128 && alpha.data[j] < 128) n++;
  }
  return n;
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

function rgbMatchesSource(
  source: RgbaImage,
  image: RgbaImage,
  j: number,
  tolerance: number,
): boolean {
  const p = j * source.channels;
  return (
    Math.abs(source.data[p] - image.data[p]) <= tolerance &&
    Math.abs(source.data[p + 1] - image.data[p + 1]) <= tolerance &&
    Math.abs(source.data[p + 2] - image.data[p + 2]) <= tolerance
  );
}

export function countSourceRgbSurvivorsInMask(
  source: RgbaImage,
  final: RgbaImage,
  alpha: Mask,
  legs: Mask,
  region: Mask,
  tolerance = 0,
): number {
  const { channels } = source;
  let n = 0;
  for (let j = 0; j < source.data.length / channels; j++) {
    if (legs.data[j] >= 128) continue;
    if (region.data[j] < 128) continue;
    if (alpha.data[j] < 128) continue;
    if (rgbMatchesSource(source, final, j, tolerance)) n++;
  }
  return n;
}

export interface ForceRemapResult {
  backgroundPixelsTouchedByCleanup: number;
}

/**
 * Force Stage 4B remapped RGB into final/recolored for alpha-on, non-leg pixels in region only.
 * Never writes when alpha is off.
 */
export function forceRemapRgbInMask(
  source: RgbaImage,
  recolored: RgbaImage,
  final: RgbaImage,
  alpha: Mask,
  legs: Mask,
  region: Mask,
  params: RelativeLRemapParams,
  stats: UpholsteryLabStats,
): ForceRemapResult {
  const { channels } = source;
  let backgroundPixelsTouchedByCleanup = 0;

  for (let j = 0; j < alpha.data.length; j++) {
    if (region.data[j] < 128) continue;
    if (legs.data[j] >= 128) continue;
    if (alpha.data[j] < 128) {
      backgroundPixelsTouchedByCleanup++;
      continue;
    }
    const p = j * channels;
    const rgb = relativeLRemapRgb(source.data[p], source.data[p + 1], source.data[p + 2], params, stats);
    recolored.data[p] = rgb.r;
    recolored.data[p + 1] = rgb.g;
    recolored.data[p + 2] = rgb.b;
    final.data[p] = rgb.r;
    final.data[p + 1] = rgb.g;
    final.data[p + 2] = rgb.b;
  }

  return { backgroundPixelsTouchedByCleanup };
}

/**
 * Foot-adjacent upholstery: kill cognac chroma without lifting shadow L (avoids pale blobs).
 */
export function forceFootAdjacentChromaRemap(
  source: RgbaImage,
  recolored: RgbaImage,
  final: RgbaImage,
  alpha: Mask,
  legs: Mask,
  region: Mask,
  params: RelativeLRemapParams,
  stats: UpholsteryLabStats,
): ForceRemapResult {
  const { channels } = source;
  let backgroundPixelsTouchedByCleanup = 0;

  for (let j = 0; j < alpha.data.length; j++) {
    if (region.data[j] < 128) continue;
    if (legs.data[j] >= 128) continue;
    if (alpha.data[j] < 128) {
      backgroundPixelsTouchedByCleanup++;
      continue;
    }
    const p = j * channels;
    const sr = source.data[p];
    const sg = source.data[p + 1];
    const sb = source.data[p + 2];
    const curLab = rgbToLab(final.data[p], final.data[p + 1], final.data[p + 2]);
    const srcLab = rgbToLab(sr, sg, sb);
    const warm = srcLab.b > params.targetB + 2 || sr > sg + 2;
    const chromaBlend = warm ? 0.52 : 0.18;
    const a = curLab.a * (1 - chromaBlend) + params.targetA * chromaBlend;
    const b = curLab.b * (1 - chromaBlend) + params.targetB * chromaBlend;
    let L = curLab.L;
    if (warm) {
      const mapped = relativeLRemapRgb(sr, sg, sb, params, stats);
      const mapLab = rgbToLab(mapped.r, mapped.g, mapped.b);
      L = curLab.L * 0.82 + mapLab.L * 0.18;
      if (L > curLab.L + 2) L = curLab.L + 2;
    }
    const rgb = labToRgb(L, a, b);
    recolored.data[p] = rgb.r;
    recolored.data[p + 1] = rgb.g;
    recolored.data[p + 2] = rgb.b;
    final.data[p] = rgb.r;
    final.data[p + 1] = rgb.g;
    final.data[p + 2] = rgb.b;
  }

  return { backgroundPixelsTouchedByCleanup };
}

export function applyStage4bEdgeFixV3(
  source: RgbaImage,
  recolored: RgbaImage,
  final: RgbaImage,
  alpha: Mask,
  legs: Mask,
  masks: Stage4bCoverageMasks,
  params: RelativeLRemapParams,
  stats: UpholsteryLabStats,
): ForceRemapResult {
  return forceRemapRgbInMask(
    source,
    recolored,
    final,
    alpha,
    legs,
    masks.cleanupUnion,
    params,
    stats,
  );
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

export function buildFootCornerRingPreviewRgb(source: RgbaImage, footCornerRing: Mask): Buffer {
  const { width, height, channels } = source;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = source.data[p];
    let g = source.data[p + 1];
    let b = source.data[p + 2];
    if (footCornerRing.data[j] >= 128) {
      r = Math.round(r * 0.35 + 255 * 0.65);
      g = Math.round(g * 0.35 + 180 * 0.65);
      b = Math.round(b * 0.35 + 60 * 0.65);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

export function buildContourRingPreviewRgb(source: RgbaImage, contourRing: Mask): Buffer {
  const { width, height, channels } = source;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = source.data[p];
    let g = source.data[p + 1];
    let b = source.data[p + 2];
    if (contourRing.data[j] >= 128) {
      r = Math.round(r * 0.35 + 255 * 0.65);
      g = Math.round(g * 0.35 + 120 * 0.65);
      b = Math.round(b * 0.35 + 40 * 0.65);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

export function buildFootAdjacentPreviewRgb(source: RgbaImage, footAdjacentUpholstery: Mask): Buffer {
  const { width, height, channels } = source;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = source.data[p];
    let g = source.data[p + 1];
    let b = source.data[p + 2];
    if (footAdjacentUpholstery.data[j] >= 128) {
      r = Math.round(r * 0.45 + 60 * 0.55);
      g = Math.round(g * 0.45 + 200 * 0.55);
      b = Math.round(b * 0.45 + 255 * 0.55);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

export function buildOwnershipDebugRgb(
  source: RgbaImage,
  legs: Mask,
  footAdjacentUpholstery: Mask,
  frontRailSeamBand: Mask,
): Buffer {
  const { width, height, channels } = source;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = source.data[p];
    let g = source.data[p + 1];
    let b = source.data[p + 2];
    if (legs.data[j] >= 128) {
      r = 220;
      g = 40;
      b = 40;
    } else if (footAdjacentUpholstery.data[j] >= 128) {
      r = 50;
      g = 200;
      b = 255;
    } else if (frontRailSeamBand.data[j] >= 128) {
      r = 255;
      g = 90;
      b = 220;
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

export interface Stage4bEdgeFixAudit {
  bandSourceRgbSurvivors: number;
  cornerSourceRgbSurvivors: number;
  footAdjacentSourceRgbSurvivors: number;
  contourSourceRgbSurvivors: number;
  backgroundPixelsTouchedByCleanup: number;
  footCornerPixelsTouchedOutsideAlpha: number;
  footAdjacentPixelsOutsideAlpha: number;
  contourPixelsTouchedOutsideAlpha: number;
}

export function auditStage4bEdgeFix(
  source: RgbaImage,
  final: RgbaImage,
  alpha: Mask,
  legs: Mask,
  masks: Stage4bCoverageMasks,
  forceResult: ForceRemapResult,
): Stage4bEdgeFixAudit {
  return {
    bandSourceRgbSurvivors: countSourceRgbSurvivorsInMask(
      source,
      final,
      alpha,
      legs,
      masks.cleanupUnion,
      0,
    ),
    cornerSourceRgbSurvivors: countSourceRgbSurvivorsInMask(
      source,
      final,
      alpha,
      legs,
      masks.footCornerRing,
      0,
    ),
    footAdjacentSourceRgbSurvivors: countSourceRgbSurvivorsInMask(
      source,
      final,
      alpha,
      legs,
      masks.footAdjacentUpholstery,
      0,
    ),
    contourSourceRgbSurvivors: countSourceRgbSurvivorsInMask(
      source,
      final,
      alpha,
      legs,
      masks.contourRing,
      0,
    ),
    backgroundPixelsTouchedByCleanup: forceResult.backgroundPixelsTouchedByCleanup,
    footCornerPixelsTouchedOutsideAlpha: countMaskPixelsOutsideAlpha(masks.footCornerRing, alpha),
    footAdjacentPixelsOutsideAlpha: countMaskPixelsOutsideAlpha(masks.footAdjacentUpholstery, alpha),
    contourPixelsTouchedOutsideAlpha: countMaskPixelsOutsideAlpha(masks.contourRing, alpha),
  };
}

export function assertStage4bEdgeFixComplete(audit: Stage4bEdgeFixAudit): void {
  const failures: string[] = [];
  if (audit.bandSourceRgbSurvivors !== 0) {
    failures.push(`bandSourceRgbSurvivors=${audit.bandSourceRgbSurvivors}`);
  }
  if (audit.cornerSourceRgbSurvivors !== 0) {
    failures.push(`cornerSourceRgbSurvivors=${audit.cornerSourceRgbSurvivors}`);
  }
  if (audit.footAdjacentSourceRgbSurvivors !== 0) {
    failures.push(`footAdjacentSourceRgbSurvivors=${audit.footAdjacentSourceRgbSurvivors}`);
  }
  if (audit.contourSourceRgbSurvivors !== 0) {
    failures.push(`contourSourceRgbSurvivors=${audit.contourSourceRgbSurvivors}`);
  }
  if (audit.backgroundPixelsTouchedByCleanup !== 0) {
    failures.push(`backgroundPixelsTouchedByCleanup=${audit.backgroundPixelsTouchedByCleanup}`);
  }
  if (audit.footCornerPixelsTouchedOutsideAlpha !== 0) {
    failures.push(`footCornerPixelsTouchedOutsideAlpha=${audit.footCornerPixelsTouchedOutsideAlpha}`);
  }
  if (audit.footAdjacentPixelsOutsideAlpha !== 0) {
    failures.push(`footAdjacentPixelsOutsideAlpha=${audit.footAdjacentPixelsOutsideAlpha}`);
  }
  if (audit.contourPixelsTouchedOutsideAlpha !== 0) {
    failures.push(`contourPixelsTouchedOutsideAlpha=${audit.contourPixelsTouchedOutsideAlpha}`);
  }
  if (failures.length) {
    throw new Error(`Stage 4B edge fix v3 incomplete: ${failures.join(', ')} (all must be 0)`);
  }
}
