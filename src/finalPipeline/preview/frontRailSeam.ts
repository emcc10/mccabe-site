import { bbox } from '../../phase1/masks.js';
import type { Mask } from '../../phase1/masks.js';
import type { RgbaImage } from '../../phase1/segment.js';
import { buildLinearL, boxBlur } from '../../phase5/labUtil.js';
import { labToRgb, rgbToLab } from '../../phase5/labUtil.js';

/** Bottom ~9% of silhouette, alpha-on, non-leg (front rail + seam trim). */
export function buildFrontRailRegion(alpha: Mask, legs: Mask): Mask {
  const bb = bbox(alpha);
  const out = new Uint8Array(alpha.data.length);
  if (!bb) return { data: out, width: alpha.width, height: alpha.height };
  const h = bb.maxY - bb.minY + 1;
  const yStart = bb.minY + Math.floor(h * (1 - 0.09));
  const xPad = Math.floor((bb.maxX - bb.minX + 1) * 0.04);
  const { width } = alpha;
  for (let y = yStart; y <= bb.maxY; y++) {
    for (let x = bb.minX + xPad; x <= bb.maxX - xPad; x++) {
      const j = y * width + x;
      if (alpha.data[j] < 128 || legs.data[j] >= 128) continue;
      out[j] = 255;
    }
  }
  return { data: out, width: alpha.width, height: alpha.height };
}

/** Thin horizontal dark seam bands in the front rail only. */
export function buildFrontRailSeamBand(
  image: RgbaImage,
  frontRail: Mask,
): { band: Mask; weights: Float32Array } {
  const { width, height } = image;
  const L = buildLinearL(image);
  const band = new Uint8Array(width * height);
  const weights = new Float32Array(width * height);
  const bb = bbox(frontRail);
  if (!bb) return { band: { data: band, width, height }, weights };

  for (let y = bb.minY; y <= bb.maxY; y++) {
    const row: { x: number; L: number; j: number }[] = [];
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (frontRail.data[j] < 128) continue;
      row.push({ x, L: L[j], j });
    }
    if (row.length < 48) continue;

    const sorted = row.map((r) => r.L).sort((a, b) => a - b);
    const rowMin = sorted[0];
    const rowMed = sorted[(sorted.length / 2) | 0];
    if (rowMed - rowMin < 1.6) continue;

    for (const r of row) {
      if (r.L > rowMin + 2) continue;
      let vertDip = 0;
      for (let dy = 2; dy <= 4; dy++) {
        const ju = (y - dy) * width + r.x;
        const jd = (y + dy) * width + r.x;
        if (frontRail.data[ju] >= 128) vertDip = Math.max(vertDip, L[ju] - r.L);
        if (frontRail.data[jd] >= 128) vertDip = Math.max(vertDip, L[jd] - r.L);
      }
      if (vertDip < 1.6) continue;
      const dip = Math.max(vertDip, rowMed - r.L);
      const w = Math.min(0.4, (dip - 1.4) / 7);
      if (w < 0.14) continue;
      weights[r.j] = Math.max(weights[r.j], w);
      band[r.j] = 255;
    }
  }

  const blurred = boxBlur(weights, width, height, 1);
  for (let i = 0; i < blurred.length; i++) {
    if (frontRail.data[i] < 128) blurred[i] = 0;
  }
  return { band: { data: band, width, height }, weights: blurred };
}

const SEAM_LIFT = 0.4;

export function applyFrontRailSeamAttenuation(
  image: RgbaImage,
  weights: Float32Array,
  alpha: Mask,
  legs: Mask,
  target: { l: number; a: number; b: number },
): { image: RgbaImage; pixelsTouched: number } {
  const out = Buffer.from(image.data);
  const { width, height, channels } = image;
  const Lmap = buildLinearL(image);
  let touched = 0;

  for (let y = 2; y < height - 2; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const w = weights[j];
      if (w < 0.05) continue;
      if (legs.data[j] >= 128 || alpha.data[j] < 128) continue;

      const p = j * channels;
      const cur = rgbToLab(out[p], out[p + 1], out[p + 2]);
      let refL = Lmap[j];
      let refA = cur.a;
      let refB = cur.b;
      let n = 0;
      for (let dy = -10; dy <= 10; dy++) {
        if (dy === 0) continue;
        const jj = (y + dy) * width + x;
        if (legs.data[jj] >= 128 || weights[jj] > 0.45 || alpha.data[jj] < 128) continue;
        const lab = rgbToLab(out[jj * channels], out[jj * channels + 1], out[jj * channels + 2]);
        refL += lab.L;
        refA += lab.a;
        refB += lab.b;
        n++;
      }
      if (n > 0) {
        refL /= n + 1;
        refA /= n + 1;
        refB /= n + 1;
      } else {
        refL = Math.max(cur.L, target.l - 3);
        refA = target.a;
        refB = target.b;
      }

      const lift = w * SEAM_LIFT;
      let L = cur.L + lift * Math.min(3.5, Math.max(0, refL - cur.L));
      L = Math.min(L, cur.L + 3.5);
      const a = cur.a;
      const b = cur.b;
      const rgb = labToRgb(L, a, b);
      out[p] = rgb.r;
      out[p + 1] = rgb.g;
      out[p + 2] = rgb.b;
      touched++;
    }
  }

  return {
    image: { data: out, width, height, channels },
    pixelsTouched: touched,
  };
}

export function buildFrontRailDebugRgb(
  image: RgbaImage,
  seamBand: Mask,
): Buffer {
  const { width, height, channels } = image;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = image.data[p];
    let g = image.data[p + 1];
    let b = image.data[p + 2];
    if (seamBand.data[j] >= 128) {
      r = Math.round(r * 0.5 + 255 * 0.5);
      g = Math.round(g * 0.5 + 80 * 0.5);
      b = Math.round(b * 0.5 + 200 * 0.5);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}
