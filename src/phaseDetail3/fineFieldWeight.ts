import type { Mask } from '../phase1/masks.js';
import { bbox } from '../phase1/masks.js';
import { boxBlur, clamp } from '../phase5/labUtil.js';
import type { RgbaImage } from '../phase1/segment.js';
import type { SourceStructureGates } from '../phase9/sourceStructure.js';
import { buildBottomGuard } from '../phase10/openFieldWeight.js';
import { rgbToLab } from '../phase5/labUtil.js';

const FEATHER_PX = 10;
const SEAM_FEATHER_PX = 6;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Fine-grain field weight: midtone open fields, heavy back/seam/cushion-break suppress.
 */
export function buildFineGrainFieldWeight(
  base6a: RgbaImage,
  upholstery: Mask,
  gates: SourceStructureGates,
  bottomGuard: Mask,
): { weight: Float32Array; backScale: Float32Array } {
  const { width, height, channels } = base6a;
  const n = width * height;
  const bb = bbox(upholstery);
  const raw = new Float32Array(n);
  const backScale = new Float32Array(n);
  if (!bb) return { weight: raw, backScale };

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);

  const expandedSeam = boxBlur(gates.seamEdge, width, height, SEAM_FEATHER_PX);

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128 || bottomGuard.data[j] >= 128) continue;

      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;

      const inBack = yNorm < 0.5 && xNorm > 0.14 && xNorm < 0.86;
      const inArm =
        yNorm >= 0.14 && yNorm < 0.7 && (xNorm < 0.3 || xNorm > 0.7);
      const inSeat = yNorm >= 0.3 && yNorm < 0.62;
      const inRail = yNorm >= 0.5 && yNorm < 0.76 && xNorm > 0.1 && xNorm < 0.9;

      if (inBack || inArm || inSeat || inRail) raw[j] = 1;

      if (yNorm < 0.48) backScale[j] = 0.58;
      else if (yNorm < 0.52) backScale[j] = 0.72;
      else backScale[j] = 1;
    }
  }

  const feathered = boxBlur(raw, width, height, FEATHER_PX);
  const weight = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    let w = clamp(feathered[j], 0, 1);

    const p = j * channels;
    const lab = rgbToLab(base6a.data[p], base6a.data[p + 1], base6a.data[p + 2]);
    const midtone = smoothstep(55, 67, lab.L) * (1 - smoothstep(75, 85, lab.L));
    w *= midtone;

    w *= 1 - expandedSeam[j] * 0.97;
    w *= 1 - gates.highlight[j] * 0.82;

    const y = (j / width) | 0;
    const x = j % width;
    const yNorm = bb ? (y - bb.minY) / spanY : 0;
    const cushionBreak =
      smoothstep(0.4, 0.46, yNorm) * (1 - smoothstep(0.54, 0.6, yNorm));
    w *= 1 - cushionBreak * 0.88;

    const shadowEdge = smoothstep(50, 60, lab.L) * (1 - smoothstep(80, 88, lab.L));
    w *= 0.4 + 0.6 * shadowEdge;

    weight[j] = clamp(w, 0, 1);
  }

  return { weight, backScale };
}

export { buildBottomGuard };
