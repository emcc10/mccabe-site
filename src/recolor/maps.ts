import { join } from 'path';
import sharp from 'sharp';
import type { ImageRGBA, MaskData } from './types.js';
import { productDir } from './paths.js';

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const rad = Math.max(1, Math.round(r));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dx = -rad; dx <= rad; dx++) {
        const xx = Math.max(0, Math.min(w - 1, x + dx));
        s += src[y * w + xx];
      }
      tmp[y * w + x] = s / (rad * 2 + 1);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = -rad; dy <= rad; dy++) {
        const yy = Math.max(0, Math.min(h - 1, y + dy));
        s += tmp[yy * w + x];
      }
      out[y * w + x] = s / (rad * 2 + 1);
    }
  }
  return out;
}

function buildLabL(image: ImageRGBA): Float32Array {
  const n = image.width * image.height;
  const L = new Float32Array(n);
  const { data, channels } = image;
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    const r = data[p] / 255;
    const g = data[p + 1] / 255;
    const b = data[p + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    L[j] = y * 100;
  }
  return L;
}

function normalizeMasked(field: Float32Array, mask: MaskData): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < field.length; j++) {
    if (mask.data[j] < 128) continue;
    min = Math.min(min, field[j]);
    max = Math.max(max, field[j]);
  }
  const span = Math.max(max - min, 1e-3);
  const out = new Float32Array(field.length);
  for (let j = 0; j < field.length; j++) {
    if (mask.data[j] < 128) out[j] = 0;
    else out[j] = (field[j] - min) / span;
  }
  return out;
}

export function buildShadowMap(baseImage: ImageRGBA, upholsteryMask: MaskData): Float32Array {
  const L = buildLabL(baseImage);
  const blur = boxBlur(L, baseImage.width, baseImage.height, 18);
  const shadow = new Float32Array(L.length);
  for (let j = 0; j < L.length; j++) {
    if (upholsteryMask.data[j] < 128) {
      shadow[j] = 0;
      continue;
    }
    shadow[j] = blur[j] / 100;
  }
  return normalizeMasked(shadow, upholsteryMask);
}

export function buildDetailMap(baseImage: ImageRGBA, upholsteryMask: MaskData): Float32Array {
  const L = buildLabL(baseImage);
  const blur = boxBlur(L, baseImage.width, baseImage.height, 6);
  const detail = new Float32Array(L.length);
  for (let j = 0; j < L.length; j++) {
    if (upholsteryMask.data[j] < 128) {
      detail[j] = 0;
      continue;
    }
    detail[j] = (L[j] - blur[j]) / 100;
  }
  return normalizeMasked(detail, upholsteryMask);
}

export function buildHighlightMap(baseImage: ImageRGBA, upholsteryMask: MaskData): Float32Array {
  const L = buildLabL(baseImage);
  const hi = new Float32Array(L.length);
  for (let j = 0; j < L.length; j++) {
    if (upholsteryMask.data[j] < 128) {
      hi[j] = 0;
      continue;
    }
    const v = L[j];
    hi[j] = v > 72 ? Math.min(1, (v - 72) / 28) : 0;
  }
  return normalizeMasked(hi, upholsteryMask);
}

export async function saveDerivedMap(
  path: string,
  field: Float32Array,
  width: number,
  height: number,
): Promise<void> {
  const buf = Buffer.alloc(width * height);
  for (let j = 0; j < field.length; j++) {
    buf[j] = Math.round(Math.max(0, Math.min(1, field[j])) * 255);
  }
  await sharp(buf, { raw: { width, height, channels: 1 } }).png().toFile(path);
}

export async function saveDerivedMaps(
  productCode: string,
  baseImage: ImageRGBA,
  upholsteryMask: MaskData,
): Promise<{ shadowPath: string; detailPath: string; highlightPath: string }> {
  const dir = productDir(productCode);
  const shadow = buildShadowMap(baseImage, upholsteryMask);
  const detail = buildDetailMap(baseImage, upholsteryMask);
  const highlight = buildHighlightMap(baseImage, upholsteryMask);
  const shadowPath = join(dir, 'shadow-map.png');
  const detailPath = join(dir, 'detail-map.png');
  const highlightPath = join(dir, 'highlight-map.png');
  await saveDerivedMap(shadowPath, shadow, baseImage.width, baseImage.height);
  await saveDerivedMap(detailPath, detail, baseImage.width, baseImage.height);
  await saveDerivedMap(highlightPath, highlight, baseImage.width, baseImage.height);
  return { shadowPath, detailPath, highlightPath };
}

export async function loadDerivedMaps(
  paths: { shadowPath: string; detailPath: string; highlightPath: string },
  upholsteryMask: MaskData,
): Promise<{ shadow: Float32Array; detail: Float32Array; highlight: Float32Array }> {
  const loadGray = async (p: string) => {
    const { data, info } = await sharp(p).grayscale().raw().toBuffer({ resolveWithObject: true });
    const f = new Float32Array(info.width * info.height);
    for (let i = 0; i < f.length; i++) f[i] = data[i] / 255;
    return f;
  };
  return {
    shadow: await loadGray(paths.shadowPath),
    detail: await loadGray(paths.detailPath),
    highlight: await loadGray(paths.highlightPath),
  };
}
