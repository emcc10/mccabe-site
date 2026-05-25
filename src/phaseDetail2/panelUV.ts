import type { Mask } from '../phase1/masks.js';
import { bbox } from '../phase1/masks.js';

export interface PanelWarp {
  scaleMul: number;
  uOffset: number;
  vOffset: number;
  rot: number;
}

export interface PanelWarpContext {
  bb: { minX: number; minY: number; maxX: number; maxY: number };
  spanX: number;
  spanY: number;
}

export function buildPanelWarpContext(upholstery: Mask): PanelWarpContext | null {
  const bb = bbox(upholstery);
  if (!bb) return null;
  return {
    bb,
    spanX: Math.max(bb.maxX - bb.minX, 1),
    spanY: Math.max(bb.maxY - bb.minY, 1),
  };
}

/** Per-cushion-panel UV warp to break stamped/tiled appearance. */
export function panelWarpForNorm(xNorm: number, yNorm: number): PanelWarp {
  if (yNorm < 0.48 && xNorm < 0.33) {
    return { scaleMul: 1.06, uOffset: 11.2, vOffset: 7.4, rot: 0.09 };
  }
  if (yNorm < 0.48 && xNorm > 0.67) {
    return { scaleMul: 1.04, uOffset: 19.8, vOffset: 5.1, rot: -0.07 };
  }
  if (yNorm < 0.48) {
    return { scaleMul: 0.98, uOffset: 14.5, vOffset: 9.2, rot: 0.04 };
  }
  if (yNorm < 0.64 && xNorm < 0.28) {
    return { scaleMul: 1.08, uOffset: 6.3, vOffset: 22.1, rot: 0.11 };
  }
  if (yNorm < 0.64 && xNorm > 0.72) {
    return { scaleMul: 1.07, uOffset: 24.6, vOffset: 18.7, rot: -0.1 };
  }
  if (yNorm < 0.64) {
    return { scaleMul: 1.02, uOffset: 16.1, vOffset: 15.3, rot: 0.02 };
  }
  if (yNorm < 0.78) {
    return { scaleMul: 0.96, uOffset: 12.8, vOffset: 28.4, rot: -0.03 };
  }
  return { scaleMul: 1, uOffset: 8, vOffset: 12, rot: 0 };
}

export function sofaToSwatchUVPanel(
  x: number,
  y: number,
  baseScale: number,
  warp: PanelWarp,
): { u: number; v: number } {
  const scale = baseScale * warp.scaleMul;
  const cx = x * scale;
  const cy = y * scale;
  const cos = Math.cos(warp.rot);
  const sin = Math.sin(warp.rot);
  const rx = cx * cos - cy * sin;
  const ry = cx * sin + cy * cos;
  return {
    u: rx * 0.4137 + ry * 0.2719 + warp.uOffset,
    v: ry * 0.3921 - rx * 0.1833 + warp.vOffset,
  };
}
