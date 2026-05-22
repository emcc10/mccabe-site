import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, intersect } from '../phase1/masks.js';
import { boxBlur } from '../phase5/labUtil.js';

/** Normalized zones within upholstery bbox (TEST-SOFA sectional layout). */
const BACK_Y_MAX = 0.46;
const BACK_X_MIN = 0.18;
const BACK_X_MAX = 0.82;

const ARM_X_OUTER_MAX = 0.26;
const ARM_X_INNER_MIN = 0.74;
const ARM_Y_MIN = 0.18;
const ARM_Y_MAX = 0.66;

const SEAT_FRONT_Y_MIN = 0.34;
const SEAT_FRONT_Y_MAX = 0.58;

const LOWER12_DILATE_PX = 8;
const FEATHER_BLUR_PX = 14;

export interface UpperUpholsteryRegion {
  /** Soft 0–1 weights, same length as upholstery.data */
  weights: Float32Array;
  /** Hard mask before feathering (for debug / counts) */
  hard: Mask;
  /** Pixels excluded to preserve lower front base rail + 6A band */
  exclude: Mask;
  definition: {
    zones: string[];
    normalizedWithin: 'upholstery-bbox';
    back: { yMax: number; xMin: number; xMax: number };
    arms: { xOuterMax: number; xInnerMin: number; yMin: number; yMax: number };
    seatFront: { yMin: number; yMax: number };
    lower12DilatePx: number;
    featherBlurPx: number;
  };
}

function emptyMask(width: number, height: number): Mask {
  return { data: new Uint8Array(width * height), width, height };
}

function countMask(m: Mask): number {
  let n = 0;
  for (let i = 0; i < m.data.length; i++) if (m.data[i] >= 128) n++;
  return n;
}

/**
 * Upper upholstery only: back cushions, upper arm fronts, seat top/front transition.
 * Excludes lower-12% alpha band (dilated) so the base rail / 6A result stays untouched.
 */
export function buildUpperUpholsteryRegion(
  upholstery: Mask,
  lower12: Mask,
): UpperUpholsteryRegion {
  const { width, height } = upholstery;
  const n = width * height;
  const bb = bbox(upholstery);
  if (!bb) {
    return {
      weights: new Float32Array(n),
      hard: emptyMask(width, height),
      exclude: emptyMask(width, height),
      definition: {
        zones: [],
        normalizedWithin: 'upholstery-bbox',
        back: { yMax: BACK_Y_MAX, xMin: BACK_X_MIN, xMax: BACK_X_MAX },
        arms: {
          xOuterMax: ARM_X_OUTER_MAX,
          xInnerMin: ARM_X_INNER_MIN,
          yMin: ARM_Y_MIN,
          yMax: ARM_Y_MAX,
        },
        seatFront: { yMin: SEAT_FRONT_Y_MIN, yMax: SEAT_FRONT_Y_MAX },
        lower12DilatePx: LOWER12_DILATE_PX,
        featherBlurPx: FEATHER_BLUR_PX,
      },
    };
  }

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);

  const exclude = intersect(dilate(lower12, LOWER12_DILATE_PX), upholstery);
  const hard = emptyMask(width, height);

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128 || exclude.data[j] >= 128) continue;

      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;

      const inBack = yNorm < BACK_Y_MAX && xNorm > BACK_X_MIN && xNorm < BACK_X_MAX;
      const inArm =
        yNorm >= ARM_Y_MIN &&
        yNorm < ARM_Y_MAX &&
        (xNorm < ARM_X_OUTER_MAX || xNorm > ARM_X_INNER_MIN);
      const inSeatFront = yNorm >= SEAT_FRONT_Y_MIN && yNorm < SEAT_FRONT_Y_MAX;

      if (inBack || inArm || inSeatFront) hard.data[j] = 255;
    }
  }

  const hardF = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (hard.data[j] >= 128) hardF[j] = 1;
  }
  const blurred = boxBlur(hardF, width, height, FEATHER_BLUR_PX);
  const weights = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    weights[j] = Math.min(1, Math.max(0, blurred[j]));
  }

  return {
    weights,
    hard,
    exclude,
    definition: {
      zones: ['back-cushions', 'upper-arm-fronts', 'seat-top-front-transition'],
      normalizedWithin: 'upholstery-bbox',
      back: { yMax: BACK_Y_MAX, xMin: BACK_X_MIN, xMax: BACK_X_MAX },
      arms: {
        xOuterMax: ARM_X_OUTER_MAX,
        xInnerMin: ARM_X_INNER_MIN,
        yMin: ARM_Y_MIN,
        yMax: ARM_Y_MAX,
      },
      seatFront: { yMin: SEAT_FRONT_Y_MIN, yMax: SEAT_FRONT_Y_MAX },
      lower12DilatePx: LOWER12_DILATE_PX,
      featherBlurPx: FEATHER_BLUR_PX,
    },
  };
}

export function upperRegionMaskToRgb(
  upholstery: Mask,
  region: UpperUpholsteryRegion,
  width: number,
  height: number,
): Buffer {
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const o = j * 3;
    if (upholstery.data[j] < 128) {
      buf[o] = 28;
      buf[o + 1] = 28;
      buf[o + 2] = 32;
      continue;
    }
    if (region.exclude.data[j] >= 128) {
      buf[o] = 200;
      buf[o + 1] = 120;
      buf[o + 2] = 40;
      continue;
    }
    const w = region.weights[j];
    if (w <= 0.02) {
      buf[o] = 48;
      buf[o + 1] = 48;
      buf[o + 2] = 56;
      continue;
    }
    const g = Math.round(40 + w * 215);
    buf[o] = Math.round(30 * (1 - w));
    buf[o + 1] = g;
    buf[o + 2] = Math.round(50 * (1 - w));
  }
  return buf;
}

export function upperRegionStats(upholstery: Mask, region: UpperUpholsteryRegion) {
  let upholPx = 0;
  let hardPx = 0;
  let weightedPx = 0;
  let excludeOverlapUphol = 0;
  let lowerOverlapHard = 0;

  for (let j = 0; j < upholstery.data.length; j++) {
    if (upholstery.data[j] < 128) continue;
    upholPx++;
    if (region.exclude.data[j] >= 128) excludeOverlapUphol++;
    if (region.hard.data[j] >= 128) {
      hardPx++;
      if (region.exclude.data[j] >= 128) lowerOverlapHard++;
    }
    if (region.weights[j] > 0.05) weightedPx++;
  }

  return {
    upholsteryPixels: upholPx,
    hardUpperPixels: hardPx,
    weightedUpperPixels: weightedPx,
    excludeOnUpholsteryPixels: excludeOverlapUphol,
    hardUpperOverlapsExclude: lowerOverlapHard,
    hardUpperMaskCount: countMask(region.hard),
    excludeMaskCount: countMask(region.exclude),
  };
}
