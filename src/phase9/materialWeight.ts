import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, intersect, union } from '../phase1/masks.js';
import { boxBlur, clamp } from '../phase5/labUtil.js';
import type { SourceStructureGates } from './sourceStructure.js';

const BACK_Y_MAX = 0.48;
const BACK_X_MIN = 0.16;
const BACK_X_MAX = 0.84;
const ARM_X_OUTER = 0.28;
const ARM_X_INNER = 0.72;
const ARM_Y_MIN = 0.16;
const ARM_Y_MAX = 0.68;
const SEAT_Y_MIN = 0.32;
const SEAT_Y_MAX = 0.6;
const FRONT_RAIL_Y_MIN = 0.52;
const FRONT_RAIL_Y_MAX = 0.74;
const FEATHER_PX = 12;

function emptyMask(width: number, height: number): Mask {
  return { data: new Uint8Array(width * height), width, height };
}

/** Where swatch micro-material should apply (open leather fields). */
export function buildSwatchMaterialWeight(
  upholstery: Mask,
  gates: SourceStructureGates,
  bottomGuard?: Mask,
): Float32Array {
  const { width, height } = upholstery;
  const n = width * height;
  const bb = bbox(upholstery);
  const hard = new Float32Array(n);
  if (!bb) return hard;

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;
      if (bottomGuard && bottomGuard.data[j] >= 128) continue;

      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;

      const inBack = yNorm < BACK_Y_MAX && xNorm > BACK_X_MIN && xNorm < BACK_X_MAX;
      const inArm =
        yNorm >= ARM_Y_MIN &&
        yNorm < ARM_Y_MAX &&
        (xNorm < ARM_X_OUTER || xNorm > ARM_X_INNER);
      const inSeat = yNorm >= SEAT_Y_MIN && yNorm < SEAT_Y_MAX;
      const inRail =
        yNorm >= FRONT_RAIL_Y_MIN && yNorm < FRONT_RAIL_Y_MAX && xNorm > 0.12 && xNorm < 0.88;

      if (inBack || inArm || inSeat || inRail) hard[j] = 1;
    }
  }

  const blurred = boxBlur(hard, width, height, FEATHER_PX);
  const weight = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    let w = clamp(blurred[j], 0, 1);
    w *= 1 - gates.seamEdge[j] * 0.88;
    w *= 1 - gates.highlight[j] * 0.55;
    weight[j] = clamp(w, 0, 1);
  }

  return weight;
}

export function buildBottomGuard(upholstery: Mask, lower12: Mask): Mask {
  const bb = bbox(upholstery);
  if (!bb) return emptyMask(upholstery.width, upholstery.height);
  const bottom = emptyMask(upholstery.width, upholstery.height);
  const yStart = bb.minY + Math.floor((bb.maxY - bb.minY + 1) * 0.84);
  for (let y = yStart; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * upholstery.width + x;
      if (upholstery.data[j] >= 128) bottom.data[j] = 255;
    }
  }
  return union(intersect(dilate(lower12, 6), upholstery), bottom);
}
