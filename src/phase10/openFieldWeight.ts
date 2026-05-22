import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, intersect, union } from '../phase1/masks.js';
import { boxBlur, clamp } from '../phase5/labUtil.js';
import type { SourceStructureGates } from '../phase9/sourceStructure.js';

const BACK_Y_MAX = 0.5;
const BACK_X_MIN = 0.14;
const BACK_X_MAX = 0.86;
const ARM_X_OUTER = 0.3;
const ARM_X_INNER = 0.7;
const ARM_Y_MIN = 0.14;
const ARM_Y_MAX = 0.7;
const SEAT_Y_MIN = 0.3;
const SEAT_Y_MAX = 0.62;
const RAIL_Y_MIN = 0.5;
const RAIL_Y_MAX = 0.76;
const FEATHER_PX = 10;

function emptyMask(width: number, height: number): Mask {
  return { data: new Uint8Array(width * height), width, height };
}

/** Open leather fields: back, seat faces, arm fronts, front rail — strong seam/highlight suppress. */
export function buildOpenFieldMaterialWeight(
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
        yNorm >= RAIL_Y_MIN && yNorm < RAIL_Y_MAX && xNorm > 0.1 && xNorm < 0.9;

      if (inBack || inArm || inSeat || inRail) hard[j] = 1;
    }
  }

  const blurred = boxBlur(hard, width, height, FEATHER_PX);
  const weight = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    let w = clamp(blurred[j], 0, 1);
    w *= 1 - gates.seamEdge[j] * 0.94;
    w *= 1 - gates.highlight[j] * 0.72;
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
