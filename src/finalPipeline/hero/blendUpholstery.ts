import type { Mask } from '../../phase1/masks.js';
import type { RgbaImage } from '../../phase1/segment.js';
import { boxBlur } from '../../phase5/labUtil.js';

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Feathered upholstery-only blend: locks non-upholstery pixels to base. */
export function blendGenerativeUpholstery(
  base: RgbaImage,
  generative: RgbaImage,
  upholstery: Mask,
  blendStrength: number,
): RgbaImage {
  const { width, height, channels } = base;
  const n = width * height;
  const hard = new Float32Array(n);
  for (let j = 0; j < n; j++) hard[j] = upholstery.data[j] >= 128 ? 1 : 0;
  const weight = boxBlur(hard, width, height, 8);

  const out = Buffer.from(base.data);
  const t = clamp(blendStrength, 0, 1);

  for (let j = 0; j < n; j++) {
    const w = weight[j] * t;
    if (w <= 0.001) continue;
    const p = j * channels;
    out[p] = Math.round(base.data[p] * (1 - w) + generative.data[p] * w);
    out[p + 1] = Math.round(base.data[p + 1] * (1 - w) + generative.data[p + 1] * w);
    out[p + 2] = Math.round(base.data[p + 2] * (1 - w) + generative.data[p + 2] * w);
    if (channels === 4) out[p + 3] = base.data[p + 3];
  }

  return { data: out, width, height, channels };
}
