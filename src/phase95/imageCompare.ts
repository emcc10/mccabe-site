import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { clamp, rgbToLab } from '../phase5/labUtil.js';

export interface UpholsteryDeltaStats {
  upholsteryPixels: number;
  meanAbsDeltaRgb: number;
  meanAbsDeltaL: number;
  meanAbsDeltaA: number;
  meanAbsDeltaB: number;
  maxAbsDeltaL: number;
  maxAbsDeltaRgb: number;
  rmsDeltaL: number;
  pixelsAboveLThreshold2: number;
  pixelsAboveLThreshold4: number;
  fractionAboveLThreshold2: number;
  ssimOnL: number;
  ssimOnRgb: number;
}

export interface CompareResult {
  stats: UpholsteryDeltaStats;
  diffRgb: Buffer;
  heatmapRgb: Buffer;
  visuallyMeaningful: boolean;
  verdict: string;
}

function computeSsim1d(a: number[], b: number[]): number {
  if (!a.length) return 1;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < a.length; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= a.length;
  meanB /= a.length;
  let varA = 0;
  let varB = 0;
  let cov = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    varA += da * da;
    varB += db * db;
    cov += da * db;
  }
  varA /= a.length;
  varB /= a.length;
  cov /= a.length;
  const c1 = (0.01 * 100) ** 2;
  const c2 = (0.03 * 100) ** 2;
  return (
    ((2 * meanA * meanB + c1) * (2 * cov + c2)) /
    ((meanA * meanA + meanB * meanB + c1) * (varA + varB + c2))
  );
}

/** Stats only — no diff buffers (for calibration loops). */
export function computeUpholsteryDeltaStats(
  prior: RgbaImage,
  current: RgbaImage,
  upholstery: Mask,
  sampleStep = 1,
): UpholsteryDeltaStats {
  if (prior.width !== current.width || prior.height !== current.height) {
    throw new Error('Compare images must match dimensions');
  }

  const n = prior.width * prior.height;
  const labPriorL: number[] = [];
  const labCurrL: number[] = [];
  const rgbPrior: number[] = [];
  const rgbCurr: number[] = [];

  let upholPx = 0;
  let sumAbsRgb = 0;
  let sumAbsL = 0;
  let sumAbsA = 0;
  let sumAbsB = 0;
  let sumSqL = 0;
  let maxAbsL = 0;
  let maxAbsRgb = 0;
  let above2 = 0;
  let above4 = 0;

  for (let j = 0; j < n; j++) {
    if (sampleStep > 1 && j % sampleStep !== 0) continue;
    if (upholstery.data[j] < 128) continue;

    const pp = j * prior.channels;
    const cp = j * current.channels;
    const dr = Math.abs(prior.data[pp] - current.data[cp]);
    const dg = Math.abs(prior.data[pp + 1] - current.data[cp + 1]);
    const db = Math.abs(prior.data[pp + 2] - current.data[cp + 2]);
    const absRgb = (dr + dg + db) / 3;

    const labP = rgbToLab(prior.data[pp], prior.data[pp + 1], prior.data[pp + 2]);
    const labC = rgbToLab(current.data[cp], current.data[cp + 1], current.data[cp + 2]);
    const dL = Math.abs(labP.L - labC.L);
    const dA = Math.abs(labP.a - labC.a);
    const dB = Math.abs(labP.b - labC.b);

    upholPx++;
    sumAbsRgb += absRgb;
    sumAbsL += dL;
    sumAbsA += dA;
    sumAbsB += dB;
    sumSqL += dL * dL;
    maxAbsL = Math.max(maxAbsL, dL);
    maxAbsRgb = Math.max(maxAbsRgb, absRgb);
    if (dL >= 2) above2++;
    if (dL >= 4) above4++;

    labPriorL.push(labP.L);
    labCurrL.push(labC.L);
    rgbPrior.push(0.2126 * prior.data[pp] + 0.7152 * prior.data[pp + 1] + 0.0722 * prior.data[pp + 2]);
    rgbCurr.push(0.2126 * current.data[cp] + 0.7152 * current.data[cp + 1] + 0.0722 * current.data[cp + 2]);
  }

  return {
    upholsteryPixels: upholPx,
    meanAbsDeltaRgb: upholPx ? sumAbsRgb / upholPx : 0,
    meanAbsDeltaL: upholPx ? sumAbsL / upholPx : 0,
    meanAbsDeltaA: upholPx ? sumAbsA / upholPx : 0,
    meanAbsDeltaB: upholPx ? sumAbsB / upholPx : 0,
    maxAbsDeltaL: maxAbsL,
    maxAbsDeltaRgb: maxAbsRgb,
    rmsDeltaL: upholPx ? Math.sqrt(sumSqL / upholPx) : 0,
    pixelsAboveLThreshold2: above2,
    pixelsAboveLThreshold4: above4,
    fractionAboveLThreshold2: upholPx ? above2 / upholPx : 0,
    ssimOnL: computeSsim1d(labPriorL, labCurrL),
    ssimOnRgb: computeSsim1d(rgbPrior, rgbCurr),
  };
}

/** Compare two same-size RGBA images inside upholstery mask. */
export function compareUpholsteryImages(
  prior: RgbaImage,
  current: RgbaImage,
  upholstery: Mask,
  sampleStep = 1,
): CompareResult {
  if (prior.width !== current.width || prior.height !== current.height) {
    throw new Error('Compare images must match dimensions');
  }

  const { width, height } = prior;
  const n = width * height;
  const diffRgb = Buffer.alloc(n * 3);
  const heatmapRgb = Buffer.alloc(n * 3);

  const labPriorL: number[] = [];
  const labCurrL: number[] = [];
  const rgbPrior: number[] = [];
  const rgbCurr: number[] = [];

  let upholPx = 0;
  let sumAbsRgb = 0;
  let sumAbsL = 0;
  let sumAbsA = 0;
  let sumAbsB = 0;
  let sumSqL = 0;
  let maxAbsL = 0;
  let maxAbsRgb = 0;
  let above2 = 0;
  let above4 = 0;

  for (let j = 0; j < n; j++) {
    if (sampleStep > 1 && j % sampleStep !== 0) continue;
    const o = j * 3;
    if (upholstery.data[j] < 128) {
      diffRgb[o] = 32;
      diffRgb[o + 1] = 32;
      diffRgb[o + 2] = 36;
      heatmapRgb[o] = 24;
      heatmapRgb[o + 1] = 24;
      heatmapRgb[o + 2] = 28;
      continue;
    }

    const pp = j * prior.channels;
    const cp = j * current.channels;
    const dr = Math.abs(prior.data[pp] - current.data[cp]);
    const dg = Math.abs(prior.data[pp + 1] - current.data[cp + 1]);
    const db = Math.abs(prior.data[pp + 2] - current.data[cp + 2]);
    const absRgb = (dr + dg + db) / 3;

    const labP = rgbToLab(prior.data[pp], prior.data[pp + 1], prior.data[pp + 2]);
    const labC = rgbToLab(current.data[cp], current.data[cp + 1], current.data[cp + 2]);
    const dL = Math.abs(labP.L - labC.L);
    const dA = Math.abs(labP.a - labC.a);
    const dB = Math.abs(labP.b - labC.b);

    upholPx++;
    sumAbsRgb += absRgb;
    sumAbsL += dL;
    sumAbsA += dA;
    sumAbsB += dB;
    sumSqL += dL * dL;
    maxAbsL = Math.max(maxAbsL, dL);
    maxAbsRgb = Math.max(maxAbsRgb, absRgb);
    if (dL >= 2) above2++;
    if (dL >= 4) above4++;

    labPriorL.push(labP.L);
    labCurrL.push(labC.L);
    rgbPrior.push(0.2126 * prior.data[pp] + 0.7152 * prior.data[pp + 1] + 0.0722 * prior.data[pp + 2]);
    rgbCurr.push(0.2126 * current.data[cp] + 0.7152 * current.data[cp + 1] + 0.0722 * current.data[cp + 2]);

    const dv = Math.round(clamp(absRgb, 0, 255));
    diffRgb[o] = dv;
    diffRgb[o + 1] = dv;
    diffRgb[o + 2] = dv;

    const amp = clamp(absRgb * 10 + dL * 4, 0, 255);
    const t = amp / 255;
    heatmapRgb[o] = Math.round(40 + t * 215);
    heatmapRgb[o + 1] = Math.round(60 * (1 - t));
    heatmapRgb[o + 2] = Math.round(90 * (1 - t));
  }

  const stats: UpholsteryDeltaStats = {
    upholsteryPixels: upholPx,
    meanAbsDeltaRgb: upholPx ? sumAbsRgb / upholPx : 0,
    meanAbsDeltaL: upholPx ? sumAbsL / upholPx : 0,
    meanAbsDeltaA: upholPx ? sumAbsA / upholPx : 0,
    meanAbsDeltaB: upholPx ? sumAbsB / upholPx : 0,
    maxAbsDeltaL: maxAbsL,
    maxAbsDeltaRgb: maxAbsRgb,
    rmsDeltaL: upholPx ? Math.sqrt(sumSqL / upholPx) : 0,
    pixelsAboveLThreshold2: above2,
    pixelsAboveLThreshold4: above4,
    fractionAboveLThreshold2: upholPx ? above2 / upholPx : 0,
    ssimOnL: computeSsim1d(labPriorL, labCurrL),
    ssimOnRgb: computeSsim1d(rgbPrior, rgbCurr),
  };

  const trivial =
    stats.meanAbsDeltaL < 0.85 &&
    stats.meanAbsDeltaRgb < 1.2 &&
    stats.fractionAboveLThreshold2 < 0.08;
  const subtle =
    stats.meanAbsDeltaL < 1.5 &&
    stats.meanAbsDeltaRgb < 2.5 &&
    stats.fractionAboveLThreshold2 < 0.2;

  let verdict: string;
  let visuallyMeaningful: boolean;
  if (trivial) {
    verdict = 'TRIVIAL — swatch transfer delta is negligible at upholstery scale';
    visuallyMeaningful = false;
  } else if (subtle) {
    verdict = 'SUBTLE — visible only in diff/heatmap, unlikely to read in normal review';
    visuallyMeaningful = false;
  } else {
    verdict = 'MEANINGFUL — delta large enough to plausibly read in side-by-side review';
    visuallyMeaningful = true;
  }

  return { stats, diffRgb, heatmapRgb, visuallyMeaningful, verdict };
}
