import convert from 'color-convert';
import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';

export interface RecolorMetrics {
  legPixels: number;
  legExactMatchRatio: number;
  upholsteryPixels: number;
  upholsteryMeanAbsDeltaRgb: number;
  /** Mean ΔE-like Lab distance: final upholstery vs source (L,a,b Euclidean) */
  upholsteryMeanLabDeltaFromSource: number;
  upholsteryLabLStdSource: number;
  upholsteryLabLStdRecolorBuffer: number;
  upholsteryLabLStdFinal: number;
  lStdPreservationRatio: number;
  structurallyCorrect: boolean;
  failReasons: string[];
}

const L_STD_MIN_RATIO = 0.82;
const LEG_EXACT_MIN_RATIO = 0.999;

function rgbToLab(r: number, g: number, b: number) {
  const [L, a, bVal] = convert.rgb.lab([r, g, b]);
  return { L, a, b: bVal };
}

function labDelta(
  s: { L: number; a: number; b: number },
  t: { L: number; a: number; b: number },
): number {
  return Math.sqrt((t.L - s.L) ** 2 + (t.a - s.a) ** 2 + (t.b - s.b) ** 2);
}

export function measureRecolorMetrics(
  source: RgbaImage,
  recolorBuffer: RgbaImage,
  final: RgbaImage,
  upholstery: Mask,
  legs: Mask,
): RecolorMetrics {
  const failReasons: string[] = [];
  let legPixels = 0;
  let legExact = 0;
  let upPixels = 0;
  let deltaSumRgb = 0;
  let deltaSumLab = 0;
  const lSrc: number[] = [];
  const lRec: number[] = [];
  const lFin: number[] = [];

  for (let j = 0; j < source.width * source.height; j++) {
    const p = j * source.channels;
    if (legs.data[j] >= 128) {
      legPixels++;
      if (
        final.data[p] === source.data[p] &&
        final.data[p + 1] === source.data[p + 1] &&
        final.data[p + 2] === source.data[p + 2]
      ) {
        legExact++;
      }
    }
    if (upholstery.data[j] < 128 || legs.data[j] >= 128) continue;
    upPixels++;
    deltaSumRgb +=
      Math.abs(final.data[p] - source.data[p]) +
      Math.abs(final.data[p + 1] - source.data[p + 1]) +
      Math.abs(final.data[p + 2] - source.data[p + 2]);
    const labSrc = rgbToLab(source.data[p], source.data[p + 1], source.data[p + 2]);
    const labFin = rgbToLab(final.data[p], final.data[p + 1], final.data[p + 2]);
    deltaSumLab += labDelta(labSrc, labFin);
    lSrc.push(labSrc.L);
    lRec.push(
      rgbToLab(recolorBuffer.data[p], recolorBuffer.data[p + 1], recolorBuffer.data[p + 2]).L,
    );
    lFin.push(labFin.L);
  }

  const std = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  };

  const legExactMatchRatio = legPixels ? legExact / legPixels : 1;
  const upholsteryLabLStdSource = std(lSrc);
  const upholsteryLabLStdRecolorBuffer = std(lRec);
  const upholsteryLabLStdFinal = std(lFin);
  const lStdPreservationRatio =
    upholsteryLabLStdSource > 0 ? upholsteryLabLStdFinal / upholsteryLabLStdSource : 1;

  if (legExactMatchRatio < LEG_EXACT_MIN_RATIO) {
    failReasons.push(
      `legs not restored from source pixels (exact match ratio ${legExactMatchRatio.toFixed(4)} < ${LEG_EXACT_MIN_RATIO})`,
    );
  }
  if (lStdPreservationRatio < L_STD_MIN_RATIO) {
    failReasons.push(
      `upholstery L structure flattened (std ratio ${lStdPreservationRatio.toFixed(4)} < ${L_STD_MIN_RATIO})`,
    );
  }

  return {
    legPixels,
    legExactMatchRatio,
    upholsteryPixels: upPixels,
    upholsteryMeanAbsDeltaRgb: upPixels ? deltaSumRgb / (upPixels * 3) : 0,
    upholsteryMeanLabDeltaFromSource: upPixels ? deltaSumLab / upPixels : 0,
    upholsteryLabLStdSource,
    upholsteryLabLStdRecolorBuffer,
    upholsteryLabLStdFinal,
    lStdPreservationRatio,
    structurallyCorrect: failReasons.length === 0,
    failReasons,
  };
}

/** @deprecated use measureRecolorMetrics */
export const measureStage2Structure = measureRecolorMetrics;
