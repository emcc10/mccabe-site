import type { Mask } from '../../phase1/masks.js';
import type { RgbaImage } from '../../phase1/segment.js';
import { buildLower12Region } from '../../phase6a/bottomSeam.js';
import { rgbToLab } from '../../phase5/labUtil.js';
import type { SwatchProfile } from '../spec.js';

const BG_WHITE = { r: 255, g: 255, b: 255 };

export interface HeroQaReport {
  feetChanged: boolean;
  feetChangedPixels: number;
  backgroundContaminated: boolean;
  backgroundContaminatedPixels: number;
  silhouetteChanged: boolean;
  silhouetteChangedPixels: number;
  bottomSeamRegression: boolean;
  muddyColorDrift: boolean;
  muddyColorDetails: { meanA: number; meanB: number; meanL: number; targetA: number; targetB: number; targetL: number };
  generativeDistortion: boolean;
  generativeDistortionScore: number;
  passed: boolean;
  failures: string[];
  verdict: string;
}

function countMaskDiff(
  source: RgbaImage,
  variant: RgbaImage,
  mask: Mask,
  threshold: number,
): number {
  let n = 0;
  const { channels } = source;
  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128) continue;
    const p = j * channels;
    const dr = Math.abs(source.data[p] - variant.data[p]);
    const dg = Math.abs(source.data[p + 1] - variant.data[p + 1]);
    const db = Math.abs(source.data[p + 2] - variant.data[p + 2]);
    if (dr + dg + db > threshold) n++;
  }
  return n;
}

function bottomSeamRegression(base: RgbaImage, variant: RgbaImage, alpha: Mask, legs: Mask): boolean {
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  let darkSpike = 0;
  let checked = 0;
  for (let j = 0; j < lower12.data.length; j++) {
    if (lower12.data[j] < 128) continue;
    checked++;
    const p = j * base.channels;
    const labB = rgbToLab(base.data[p], base.data[p + 1], base.data[p + 2]);
    const labV = rgbToLab(variant.data[p], variant.data[p + 1], variant.data[p + 2]);
    if (labB.L - labV.L > 6) darkSpike++;
  }
  return checked > 0 && darkSpike / checked > 0.12;
}

function meanUpholsteryLab(image: RgbaImage, upholstery: Mask, profile: SwatchProfile) {
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let n = 0;
  const { channels } = image;
  for (let j = 0; j < upholstery.data.length; j++) {
    if (upholstery.data[j] < 128) continue;
    const p = j * channels;
    const lab = rgbToLab(image.data[p], image.data[p + 1], image.data[p + 2]);
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
    n++;
  }
  if (!n) return { meanL: 0, meanA: 0, meanB: 0 };
  return { meanL: sumL / n, meanA: sumA / n, meanB: sumB / n };
}

/** Tile-based high-frequency spike detector on upholstery vs base. */
function generativeDistortionScore(
  base: RgbaImage,
  variant: RgbaImage,
  upholstery: Mask,
): number {
  const { width, height, channels } = base;
  const tile = 16;
  let badTiles = 0;
  let tiles = 0;

  for (let y0 = 0; y0 < height - tile; y0 += tile) {
    for (let x0 = 0; x0 < width - tile; x0 += tile) {
      let upholPx = 0;
      let sumAbs = 0;
      for (let y = y0; y < y0 + tile; y++) {
        for (let x = x0; x < x0 + tile; x++) {
          const j = y * width + x;
          if (upholstery.data[j] < 128) continue;
          upholPx++;
          const p = j * channels;
          sumAbs +=
            (Math.abs(base.data[p] - variant.data[p]) +
              Math.abs(base.data[p + 1] - variant.data[p + 1]) +
              Math.abs(base.data[p + 2] - variant.data[p + 2])) /
            3;
        }
      }
      if (upholPx < tile * tile * 0.45) continue;
      tiles++;
      const mean = sumAbs / upholPx;
      if (mean > 28) badTiles++;
    }
  }

  return tiles ? badTiles / tiles : 0;
}

export function runHeroQa(
  source: RgbaImage,
  base: RgbaImage,
  hero: RgbaImage,
  profile: SwatchProfile,
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
): HeroQaReport {
  const failures: string[] = [];

  const feetChangedPixels = countMaskDiff(source, hero, legs, 3);
  const feetChanged = feetChangedPixels > 0;
  if (feetChanged) failures.push(`Feet changed (${feetChangedPixels}px)`);

  let backgroundContaminatedPixels = 0;
  let silhouetteChangedPixels = 0;
  const { width, height, channels } = source;
  for (let j = 0; j < width * height; j++) {
    if (alpha.data[j] >= 128) continue;
    const p = j * channels;
    const dr = Math.abs(source.data[p] - hero.data[p]);
    const dg = Math.abs(source.data[p + 1] - hero.data[p + 1]);
    const db = Math.abs(source.data[p + 2] - hero.data[p + 2]);
    if (dr + dg + db > 6) silhouetteChangedPixels++;
    const r = hero.data[p];
    const g = hero.data[p + 1];
    const b = hero.data[p + 2];
    if (
      Math.abs(r - BG_WHITE.r) > 2 ||
      Math.abs(g - BG_WHITE.g) > 2 ||
      Math.abs(b - BG_WHITE.b) > 2
    ) {
      backgroundContaminatedPixels++;
    }
  }
  const backgroundContaminated = backgroundContaminatedPixels > 0;
  const silhouetteChanged = silhouetteChangedPixels > 40;
  if (backgroundContaminated) {
    failures.push(`Background contaminated (${backgroundContaminatedPixels}px)`);
  }
  if (silhouetteChanged) {
    failures.push(`Silhouette/background drift (${silhouetteChangedPixels}px)`);
  }

  const bottomSeamRegressionFlag = bottomSeamRegression(base, hero, alpha, legs);
  if (bottomSeamRegressionFlag) failures.push('Bottom seam dark-line regression');

  const lab = meanUpholsteryLab(hero, upholstery, profile);
  const { targetLab } = profile;
  const dA = Math.abs(lab.meanA - targetLab.a);
  const dB = Math.abs(lab.meanB - targetLab.b);
  const dL = Math.abs(lab.meanL - targetLab.l);
  const muddy =
    (dA > 4.5 || dB > 6) && lab.meanL < targetLab.l - 6 && lab.meanB < targetLab.b - 2;
  if (muddy) failures.push(`Muddy color drift (mean LAB ${lab.meanL.toFixed(1)}, ${lab.meanA.toFixed(1)}, ${lab.meanB.toFixed(1)})`);

  const distortionScore = generativeDistortionScore(base, hero, upholstery);
  const generativeDistortion = distortionScore > 0.22;
  if (generativeDistortion) {
    failures.push(`Obvious generative distortion (tile spike ratio ${(distortionScore * 100).toFixed(1)}%)`);
  }

  const passed = failures.length === 0;
  const verdict = passed ? 'PASS' : `FAIL — ${failures.join('; ')}`;

  return {
    feetChanged,
    feetChangedPixels,
    backgroundContaminated,
    backgroundContaminatedPixels,
    silhouetteChanged,
    silhouetteChangedPixels,
    bottomSeamRegression: bottomSeamRegressionFlag,
    muddyColorDrift: muddy,
    muddyColorDetails: {
      meanL: lab.meanL,
      meanA: lab.meanA,
      meanB: lab.meanB,
      targetL: targetLab.l,
      targetA: targetLab.a,
      targetB: targetLab.b,
    },
    generativeDistortion,
    generativeDistortionScore: distortionScore,
    passed,
    failures,
    verdict,
  };
}
