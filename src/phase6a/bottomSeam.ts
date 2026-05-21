import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, erode, intersect, subtract, union } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import type { Stage4bCoverageMasks } from '../phase4b/coverage.js';
import { buildLinearL, labToRgb, rgbToLab } from '../phase5/labUtil.js';

const LOWER_FRAC = 0.12;
const FRONTIER_DILATE_PX = 2;
const SAMPLE_UP_MIN = 6;
const SAMPLE_UP_MAX = 28;
const REPAIR_BLEND = 0.88;

export interface BottomSeamDiagnostics {
  lower12PixelCount: number;
  cleanupBandPixelCount: number;
  overlapEdgeBandPx: number;
  overlapContourRingPx: number;
  overlapOutsideCoreUpholsteryPx: number;
  meanLInBandBefore: number;
  meanLInBandAfter: number;
  backgroundPixelsTouched: number;
  pixelsRepaired: number;
}

export interface BottomSeamResult {
  image: RgbaImage;
  cleanupBand: Mask;
  diagnostics: BottomSeamDiagnostics;
}

function emptyMask(width: number, height: number): Mask {
  return { data: new Uint8Array(width * height), width, height };
}

function countMask(m: Mask): number {
  let n = 0;
  for (let i = 0; i < m.data.length; i++) if (m.data[i] >= 128) n++;
  return n;
}

function countOverlap(a: Mask, b: Mask): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i++) {
    if (a.data[i] >= 128 && b.data[i] >= 128) n++;
  }
  return n;
}

function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Lower 12% of alpha bbox, alpha-on, non-leg. */
export function buildLower12Region(alpha: Mask, legs: Mask): { mask: Mask; yStart: number } {
  const bb = bbox(alpha);
  if (!bb) return { mask: emptyMask(alpha.width, alpha.height), yStart: alpha.height };
  const yStart = bb.minY + Math.floor((bb.maxY - bb.minY + 1) * (1 - LOWER_FRAC));
  const out = emptyMask(alpha.width, alpha.height);
  const { width } = alpha;
  for (let y = yStart; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (alpha.data[j] < 128 || legs.data[j] >= 128) continue;
      out.data[j] = 255;
    }
  }
  return { mask: intersect(out, alpha), yStart };
}

export function buildBottomCleanupBandFromImage(
  image: RgbaImage,
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
  lower12: Mask,
  coverage?: Stage4bCoverageMasks,
): Mask {
  const { width, height, channels } = image;
  const frontier = emptyMask(width, height);
  const nonLeg = intersect(subtract(alpha, legs), alpha);

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128 || lower12.data[j] < 128) continue;
      const below = j + width;
      if (upholstery.data[below] < 128 || legs.data[below] >= 128) frontier.data[j] = 255;
    }
  }

  const trimSeam = intersect(
    subtract(intersect(dilate(upholstery, 3), alpha), erode(upholstery, 1)),
    lower12,
  );

  const brightSeam = emptyMask(width, height);
  for (let y = 2; y < height - 2; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (lower12.data[j] < 128 || alpha.data[j] < 128 || legs.data[j] >= 128) continue;
      const p = j * channels;
      const Lc = lum(image.data[p], image.data[p + 1], image.data[p + 2]);
      const jm = (y - 2) * width + x;
      const jp = (y + 2) * width + x;
      const pm = jm * channels;
      const pp = jp * channels;
      const gradY = Math.abs(
        lum(image.data[pm], image.data[pm + 1], image.data[pm + 2]) -
          lum(image.data[pp], image.data[pp + 1], image.data[pp + 2]),
      );
      const j1 = (y - 1) * width + x;
      const p1 = j1 * channels;
      const Labove = lum(image.data[p1], image.data[p1 + 1], image.data[p1 + 2]);
      if (gradY > 10 && Lc > Labove + 4 && Lc > 65) brightSeam.data[j] = 255;
    }
  }

  const nearUpholLower = intersect(lower12, dilate(upholstery, 4));
  const upholBoundary = intersect(subtract(nearUpholLower, erode(upholstery, 2)), nonLeg);

  const edgeInLower = coverage
    ? intersect(lower12, union(coverage.edgeBandOnly, coverage.contourRing))
    : emptyMask(width, height);

  const recolorTrim = coverage
    ? intersect(lower12, subtract(coverage.upholsteryRecolor, upholstery))
    : emptyMask(width, height);

  return dilate(
    intersect(
      union(frontier, trimSeam, brightSeam, upholBoundary, edgeInLower, recolorTrim),
      nonLeg,
    ),
    FRONTIER_DILATE_PX,
  );
}

function sampleRepairNeighborhood(
  image: RgbaImage,
  legs: Mask,
  upholstery: Mask,
  width: number,
  height: number,
  x: number,
  y: number,
): { L: number; a: number; b: number } | null {
  const ls: number[] = [];
  const as: number[] = [];
  const bs: number[] = [];
  for (let dy = SAMPLE_UP_MIN; dy <= SAMPLE_UP_MAX; dy++) {
    const yy = y - dy;
    if (yy < 0) break;
    for (let dx = -10; dx <= 10; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= width) continue;
      const j = yy * width + xx;
      if (upholstery.data[j] < 128 || legs.data[j] >= 128) continue;
      const p = j * image.channels;
      const lab = rgbToLab(image.data[p], image.data[p + 1], image.data[p + 2]);
      if (lab.L > 83) continue;
      ls.push(lab.L);
      as.push(lab.a);
      bs.push(lab.b);
    }
  }
  if (!ls.length) {
    for (let dy = SAMPLE_UP_MIN; dy <= SAMPLE_UP_MAX; dy++) {
      const yy = y - dy;
      if (yy < 0) break;
      for (let dx = -6; dx <= 6; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        const j = yy * width + xx;
        if (upholstery.data[j] < 128 || legs.data[j] >= 128) continue;
        const p = j * image.channels;
        const lab = rgbToLab(image.data[p], image.data[p + 1], image.data[p + 2]);
        ls.push(lab.L);
        as.push(lab.a);
        bs.push(lab.b);
      }
    }
  }
  if (!ls.length) return null;
  const mid = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[(s.length / 2) | 0];
  };
  return { L: mid(ls), a: mid(as), b: mid(bs) };
}

export function diagnoseBottomSeam(
  image: RgbaImage,
  cleanupBand: Mask,
  upholstery: Mask,
  coverage: Stage4bCoverageMasks,
): Omit<
  BottomSeamDiagnostics,
  'lower12PixelCount' | 'cleanupBandPixelCount' | 'meanLInBandBefore' | 'meanLInBandAfter' | 'backgroundPixelsTouched'
> {
  const outsideUphol = subtract(cleanupBand, upholstery);
  return {
    overlapEdgeBandPx: countOverlap(cleanupBand, coverage.edgeBandOnly),
    overlapContourRingPx: countOverlap(cleanupBand, coverage.contourRing),
    overlapOutsideCoreUpholsteryPx: countMask(outsideUphol),
  };
}

function globalUpholsteryLab(image: RgbaImage, upholstery: Mask) {
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let n = 0;
  const { channels } = image;
  for (let j = 0; j < upholstery.data.length; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(image.data[p], image.data[p + 1], image.data[p + 2]);
    if (lab.L > 83) continue;
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
    n++;
  }
  if (!n) return meanUpholsteryLabFallback(image, upholstery);
  return { L: sumL / n, a: sumA / n, b: sumB / n };
}

function meanUpholsteryLabFallback(image: RgbaImage, upholstery: Mask) {
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let n = 0;
  const { channels } = image;
  for (let j = 0; j < upholstery.data.length; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(image.data[p], image.data[p + 1], image.data[p + 2]);
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
    n++;
  }
  return { L: n ? sumL / n : 72, a: n ? sumA / n : 0, b: n ? sumB / n : 4 };
}

export function applyBottomSeamCleanup(
  image: RgbaImage,
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
  coverage: Stage4bCoverageMasks,
): BottomSeamResult {
  const { width, height, channels } = image;
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const cleanupBand = buildBottomCleanupBandFromImage(
    image,
    alpha,
    upholstery,
    legs,
    lower12,
    coverage,
  );
  const upholRef = globalUpholsteryLab(image, upholstery);

  let sumLBefore = 0;
  let sumLAfter = 0;
  let bandCount = 0;
  let bgTouched = 0;
  let repairedCount = 0;

  const out = Buffer.from(image.data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (cleanupBand.data[j] < 128) continue;
      if (legs.data[j] >= 128) continue;
      if (alpha.data[j] < 128) {
        bgTouched++;
        continue;
      }

      const p = j * channels;
      const cur = rgbToLab(out[p], out[p + 1], out[p + 2]);
      sumLBefore += cur.L;
      bandCount++;

      const local = sampleRepairNeighborhood(image, legs, upholstery, width, height, x, y);
      const sample = local ?? upholRef;

      let blend = REPAIR_BLEND;
      if (cur.L > sample.L + 5) blend = 0.92;
      let L = cur.L * (1 - blend) + sample.L * blend;
      if (cur.L > 86) L = Math.min(L, sample.L + 3);
      const a = cur.a * (1 - blend) + sample.a * blend;
      const b = cur.b * (1 - blend) + sample.b * blend;
      const rgb = labToRgb(L, a, b);
      out[p] = rgb.r;
      out[p + 1] = rgb.g;
      out[p + 2] = rgb.b;
      sumLAfter += L;
      repairedCount++;
    }
  }

  const overlapDiag = diagnoseBottomSeam(image, cleanupBand, upholstery, coverage);

  return {
    image: { data: out, width, height, channels },
    cleanupBand,
    diagnostics: {
      lower12PixelCount: countMask(lower12),
      cleanupBandPixelCount: countMask(cleanupBand),
      ...overlapDiag,
      meanLInBandBefore: bandCount ? sumLBefore / bandCount : 0,
      meanLInBandAfter: repairedCount ? sumLAfter / repairedCount : 0,
      backgroundPixelsTouched: bgTouched,
      pixelsRepaired: repairedCount,
    },
  };
}

export function buildBottomSeamDebugRgb(
  image: RgbaImage,
  cleanupBand: Mask,
  lower12: Mask,
): Buffer {
  const { width, height, channels } = image;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = image.data[p];
    let g = image.data[p + 1];
    let b = image.data[p + 2];
    if (lower12.data[j] >= 128 && cleanupBand.data[j] < 128) {
      g = Math.round(g * 0.5 + 80 * 0.5);
    }
    if (cleanupBand.data[j] >= 128) {
      r = Math.round(r * 0.35 + 255 * 0.65);
      g = Math.round(g * 0.35 + 40 * 0.65);
      b = Math.round(b * 0.35 + 255 * 0.65);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}
