import convert from 'color-convert';
import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';

export interface RelativeLRemapParams {
  lLow: number;
  lHigh: number;
  /** Fraction of mapped L (remainder is source L) */
  mappedLBlend: number;
  targetA: number;
  targetB: number;
  chromaSourceA: number;
  chromaSourceB: number;
  chromaTargetA: number;
  chromaTargetB: number;
}

export interface UpholsteryLabStats {
  minL: number;
  maxL: number;
  meanL: number;
  p5: number;
  p95: number;
}

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

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeUpholsteryLabStats(source: RgbaImage, upholstery: Mask): UpholsteryLabStats {
  const Ls: number[] = [];
  const { width, height, channels } = source;
  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    Ls.push(rgbToLab(source.data[p], source.data[p + 1], source.data[p + 2]).L);
  }
  Ls.sort((a, b) => a - b);
  const meanL = Ls.length ? Ls.reduce((s, v) => s + v, 0) / Ls.length : 0;
  return {
    minL: Ls[0] ?? 0,
    maxL: Ls[Ls.length - 1] ?? 0,
    meanL,
    p5: percentile(Ls, 0.05),
    p95: percentile(Ls, 0.95),
  };
}

export function relativeLRemapRgb(
  r: number,
  g: number,
  b: number,
  params: RelativeLRemapParams,
  stats: UpholsteryLabStats,
): { r: number; g: number; b: number } {
  const span = Math.max(0.5, stats.p95 - stats.p5);
  const sourceLBlend = 1 - params.mappedLBlend;
  const src = rgbToLab(r, g, b);
  const Ln = clamp((src.L - stats.p5) / span, 0, 1);
  const L_mapped = params.lLow + Ln * (params.lHigh - params.lLow);
  const L_out = L_mapped * params.mappedLBlend + src.L * sourceLBlend;
  const a_out = src.a * params.chromaSourceA + params.targetA * params.chromaTargetA;
  const b_out = src.b * params.chromaSourceB + params.targetB * params.chromaTargetB;
  return labToRgb(L_out, a_out, b_out);
}

/** Apply Stage 4 relative L remap to every pixel in `mask` (writes into `out`). */
export function applyRelativeLRemapToMask(
  source: RgbaImage,
  out: RgbaImage,
  mask: Mask,
  params: RelativeLRemapParams,
  stats: UpholsteryLabStats,
): void {
  const { width, height, channels } = source;
  for (let j = 0; j < width * height; j++) {
    if (mask.data[j] < 128) continue;
    const p = j * channels;
    const rgb = relativeLRemapRgb(source.data[p], source.data[p + 1], source.data[p + 2], params, stats);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = source.data[p + 3];
  }
}

/**
 * Stage 4: relative luminance remap + swatch chroma (not preserveLuminance/chromaBlend).
 */
export function recolorUpholsteryRelativeLRemap(
  source: RgbaImage,
  upholstery: Mask,
  params: RelativeLRemapParams,
  stats?: UpholsteryLabStats,
): { image: RgbaImage; stats: UpholsteryLabStats } {
  const labStats = stats ?? computeUpholsteryLabStats(source, upholstery);
  const span = Math.max(0.5, labStats.p95 - labStats.p5);
  const sourceLBlend = 1 - params.mappedLBlend;

  const out = Buffer.from(source.data);
  const { width, height, channels } = source;

  for (let j = 0; j < width * height; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const src = rgbToLab(source.data[p], source.data[p + 1], source.data[p + 2]);

    const Ln = clamp((src.L - labStats.p5) / span, 0, 1);
    const L_mapped = params.lLow + Ln * (params.lHigh - params.lLow);
    const L_out = L_mapped * params.mappedLBlend + src.L * sourceLBlend;

    const a_out = src.a * params.chromaSourceA + params.targetA * params.chromaTargetA;
    const b_out = src.b * params.chromaSourceB + params.targetB * params.chromaTargetB;

    const rgb = labToRgb(L_out, a_out, b_out);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = source.data[p + 3];
  }

  return {
    image: { data: out, width, height, channels },
    stats: labStats,
  };
}
