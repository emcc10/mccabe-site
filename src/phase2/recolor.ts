import convert from 'color-convert';
import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function rgbToLab(r: number, g: number, b: number) {
  const [L, a, bVal] = convert.rgb.lab([r, g, b]);
  return { L, a, b: bVal };
}

function labToRgb(L: number, a: number, b: number) {
  const [r, g, bOut] = convert.lab.rgb([
    clamp(L, 0, 100),
    clamp(a, -128, 128),
    clamp(b, -128, 128),
  ]);
  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(bOut, 0, 255)),
  };
}

/**
 * Minimal recolor: keep source L structure; shift upholstery a/b toward swatch.
 * No maps, texture, or realism logic.
 */
export function recolorUpholsteryMinimal(
  source: RgbaImage,
  upholstery: Mask,
  targetLab: { l: number; a: number; b: number },
  preserveL: number,
  chromaBlend: number,
): RgbaImage {
  const out = Buffer.from(source.data);
  const { width, height, channels } = source;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const src = rgbToLab(source.data[p], source.data[p + 1], source.data[p + 2]);

    const L = src.L * preserveL + targetLab.l * (1 - preserveL);
    const a = src.a * (1 - chromaBlend) + targetLab.a * chromaBlend;
    const b = src.b * (1 - chromaBlend) + targetLab.b * chromaBlend;

    const rgb = labToRgb(L, a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = source.data[p + 3];
  }

  return { data: out, width, height, channels };
}
