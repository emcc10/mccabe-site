import type { Mask } from '../phase1/masks.js';
import { bbox } from '../phase1/masks.js';
import { boxBlur, clamp } from '../phase5/labUtil.js';
import type { RgbaImage } from '../phase1/segment.js';
import type { SourceStructureGates } from '../phase9/sourceStructure.js';
import { buildBottomGuard } from '../phase10/openFieldWeight.js';
import { rgbToLab } from '../phase5/labUtil.js';

const FEATHER_PX = 8;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Midtone open-field weight: feathered, suppresses highlights/seams/shadows/edges.
 */
export function buildMidtoneFieldWeight(
  base6a: RgbaImage,
  upholstery: Mask,
  gates: SourceStructureGates,
  bottomGuard: Mask,
): Float32Array {
  const { width, height, channels } = base6a;
  const n = width * height;
  const bb = bbox(upholstery);
  const raw = new Float32Array(n);
  if (!bb) return raw;

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128 || bottomGuard.data[j] >= 128) continue;

      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;

      const inBack = yNorm < 0.5 && xNorm > 0.14 && xNorm < 0.86;
      const inArm =
        yNorm >= 0.14 &&
        yNorm < 0.7 &&
        (xNorm < 0.3 || xNorm > 0.7);
      const inSeat = yNorm >= 0.3 && yNorm < 0.62;
      const inRail = yNorm >= 0.5 && yNorm < 0.76 && xNorm > 0.1 && xNorm < 0.9;

      if (inBack || inArm || inSeat || inRail) raw[j] = 1;
    }
  }

  const feathered = boxBlur(raw, width, height, FEATHER_PX);
  const weight = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    let w = clamp(feathered[j], 0, 1);

    const p = j * channels;
    const lab = rgbToLab(base6a.data[p], base6a.data[p + 1], base6a.data[p + 2]);
    const midtone = smoothstep(54, 66, lab.L) * (1 - smoothstep(76, 86, lab.L));
    w *= midtone;

    w *= 1 - gates.seamEdge[j] * 0.94;
    w *= 1 - gates.highlight[j] * 0.78;

    const shadowEdge = smoothstep(48, 58, lab.L) * (1 - smoothstep(82, 90, lab.L));
    w *= 0.35 + 0.65 * shadowEdge;

    weight[j] = clamp(w, 0, 1);
  }

  return weight;
}

export { buildBottomGuard };
