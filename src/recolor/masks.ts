import sharp from 'sharp';
import type { MaskData } from './types.js';

export const MASK_ON = 255;
export const MASK_OFF = 0;

export async function loadMask(path: string): Promise<MaskData> {
  const { data, info } = await sharp(path).grayscale().raw().toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i] >= 128 ? MASK_ON : MASK_OFF;
  return { data: out, width: info.width, height: info.height };
}

export async function saveMask(path: string, mask: MaskData): Promise<void> {
  const buf = Buffer.alloc(mask.width * mask.height);
  for (let i = 0; i < mask.data.length; i++) buf[i] = mask.data[i] >= 128 ? 255 : 0;
  await sharp(buf, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toFile(path);
}

function idx(mask: MaskData, x: number, y: number): number {
  return y * mask.width + x;
}

export function dilateMask(mask: MaskData, px: number): MaskData {
  if (px <= 0) return { ...mask, data: new Uint8Array(mask.data) };
  const out = new Uint8Array(mask.data);
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      const j = idx(mask, x, y);
      if (mask.data[j] < 128) continue;
      for (let dy = -px; dy <= px; dy++) {
        for (let dx = -px; dx <= px; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= mask.width || yy >= mask.height) continue;
          out[idx(mask, xx, yy)] = MASK_ON;
        }
      }
    }
  }
  return { ...mask, data: out };
}

export function erodeMask(mask: MaskData, px: number): MaskData {
  if (px <= 0) return { ...mask, data: new Uint8Array(mask.data) };
  const out = new Uint8Array(mask.data.length);
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      const j = idx(mask, x, y);
      if (mask.data[j] < 128) {
        out[j] = MASK_OFF;
        continue;
      }
      let keep = true;
      for (let dy = -px; dy <= px && keep; dy++) {
        for (let dx = -px; dx <= px; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= mask.width || yy >= mask.height) {
            keep = false;
            break;
          }
          if (mask.data[idx(mask, xx, yy)] < 128) keep = false;
        }
      }
      out[j] = keep ? MASK_ON : MASK_OFF;
    }
  }
  return { ...mask, data: out };
}

export function subtractMask(a: MaskData, b: MaskData): MaskData {
  const out = new Uint8Array(a.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = a.data[i] >= 128 && b.data[i] < 128 ? MASK_ON : MASK_OFF;
  }
  return { ...a, data: out };
}

export function intersectMask(a: MaskData, b: MaskData): MaskData {
  const out = new Uint8Array(a.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = a.data[i] >= 128 && b.data[i] >= 128 ? MASK_ON : MASK_OFF;
  }
  return { ...a, data: out };
}

export function cleanupConnectedComponents(mask: MaskData, minArea: number): MaskData {
  const w = mask.width;
  const h = mask.height;
  const labels = new Int32Array(mask.data.length);
  let nextLabel = 1;
  const areas = new Map<number, number>();

  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128 || labels[j] !== 0) continue;
    const stack = [j];
    labels[j] = nextLabel;
    let area = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      area++;
      const x = cur % w;
      const y = (cur / w) | 0;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = yy * w + xx;
        if (mask.data[k] < 128 || labels[k] !== 0) continue;
        labels[k] = nextLabel;
        stack.push(k);
      }
    }
    areas.set(nextLabel, area);
    nextLabel++;
  }

  const out = new Uint8Array(mask.data);
  for (let j = 0; j < mask.data.length; j++) {
    const lab = labels[j];
    if (lab === 0) {
      out[j] = MASK_OFF;
      continue;
    }
    const area = areas.get(lab) ?? 0;
    out[j] = area >= minArea ? MASK_ON : MASK_OFF;
  }
  return { ...mask, data: out };
}

/** Edge-only feather inside silhouette — does not replace product alpha. */
export function featherInteriorEdges(mask: MaskData, radius: number): MaskData {
  if (radius <= 0) return { ...mask, data: new Uint8Array(mask.data) };
  const dist = inwardDistance(mask);
  const out = new Uint8Array(mask.data);
  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128) {
      out[j] = MASK_OFF;
      continue;
    }
    const d = dist[j];
    if (d >= radius) out[j] = MASK_ON;
    else out[j] = Math.round((d / radius) * 255);
  }
  return { ...mask, data: out };
}

export function inwardDistance(mask: MaskData): Float32Array {
  const w = mask.width;
  const h = mask.height;
  const dist = new Float32Array(mask.data.length);
  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128) {
      dist[j] = 0;
      continue;
    }
    const x = j % w;
    const y = (j / w) | 0;
    let edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    if (!edge) {
      for (const k of [j - 1, j + 1, j - w, j + w]) {
        if (mask.data[k] < 128) edge = true;
      }
    }
    dist[j] = edge ? 0 : 1e6;
  }
  for (let pass = 0; pass < w + h; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = y * w + x;
        if (mask.data[j] < 128 || dist[j] === 0) continue;
        let best = dist[j];
        if (x > 0 && mask.data[j - 1] >= 128) best = Math.min(best, dist[j - 1] + 1);
        if (x < w - 1 && mask.data[j + 1] >= 128) best = Math.min(best, dist[j + 1] + 1);
        if (y > 0 && mask.data[j - w] >= 128) best = Math.min(best, dist[j - w] + 1);
        if (y < h - 1 && mask.data[j + w] >= 128) best = Math.min(best, dist[j + w] + 1);
        dist[j] = best;
      }
    }
  }
  return dist;
}

export function maskBoundingBox(mask: MaskData) {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x] < 128) continue;
      any = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return any ? { minX, minY, maxX, maxY } : null;
}
