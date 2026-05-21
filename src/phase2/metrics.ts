import convert from 'color-convert';
import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';

export interface Stage2StructuralMetrics {
  legPixels: number;
  legExactMatchRatio: number;
  upholsteryPixels: number;
  upholsteryMeanAbsDeltaRgb: number;
  upholsteryLabLStdSource: number;
  upholsteryLabLStdRecolorBuffer: number;
  upholsteryLabLStdFinal: number;
  lStdPreservationRatio: number;
  structurallyCorrect: boolean;
  failReasons: string[];
}

const L_STD_MIN_RATIO = 0.82;
const LEG_EXACT_MIN_RATIO = 0.999;

function labL(r: number, g: number, b: number): number {
  return convert.rgb.lab([r, g, b])[0];
}

export function measureStage2Structure(
  source: RgbaImage,
  recolorBuffer: RgbaImage,
  final: RgbaImage,
  upholstery: Mask,
  legs: Mask,
): Stage2StructuralMetrics {
  const failReasons: string[] = [];
  let legPixels = 0;
  let legExact = 0;
  let upPixels = 0;
  let deltaSum = 0;
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
    deltaSum +=
      Math.abs(final.data[p] - source.data[p]) +
      Math.abs(final.data[p + 1] - source.data[p + 1]) +
      Math.abs(final.data[p + 2] - source.data[p + 2]);
    lSrc.push(labL(source.data[p], source.data[p + 1], source.data[p + 2]));
    lRec.push(labL(recolorBuffer.data[p], recolorBuffer.data[p + 1], recolorBuffer.data[p + 2]));
    lFin.push(labL(final.data[p], final.data[p + 1], final.data[p + 2]));
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
    upholsteryMeanAbsDeltaRgb: upPixels ? deltaSum / (upPixels * 3) : 0,
    upholsteryLabLStdSource,
    upholsteryLabLStdRecolorBuffer,
    upholsteryLabLStdFinal,
    lStdPreservationRatio,
    structurallyCorrect: failReasons.length === 0,
    failReasons,
  };
}
