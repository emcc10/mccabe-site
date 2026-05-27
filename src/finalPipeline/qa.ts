import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';
import { buildLower12Region } from '../phase6a/bottomSeam.js';
import { rgbToLab } from '../phase5/labUtil.js';
import type { QaArtifactReport, RealismApplyParams, VariantResult } from './spec.js';
import type { RealismVariantSpec } from './swatchProfiles.js';
import { qaPath } from './paths.js';

const BG_WHITE = { r: 255, g: 255, b: 255 };

function countChangedPixels(
  a: RgbaImage,
  b: RgbaImage,
  mask: Mask,
  threshold = 3,
): number {
  let n = 0;
  const { width, height, channels } = a;
  for (let j = 0; j < width * height; j++) {
    if (mask.data[j] < 128) continue;
    const p = j * channels;
    const dr = Math.abs(a.data[p] - b.data[p]);
    const dg = Math.abs(a.data[p + 1] - b.data[p + 1]);
    const db = Math.abs(a.data[p + 2] - b.data[p + 2]);
    if (dr + dg + db > threshold) n++;
  }
  return n;
}

function bottomSeamRegression(
  base: RgbaImage,
  variant: RgbaImage,
  alpha: Mask,
  legs: Mask,
): boolean {
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

export function runArtifactChecks(
  source: RgbaImage,
  base: RgbaImage,
  variant: RgbaImage,
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
  compare: ReturnType<typeof compareUpholsteryImages>,
): QaArtifactReport {
  const failures: string[] = [];

  const feetChangedPixels = countChangedPixels(source, variant, legs);
  const feetChanged = feetChangedPixels > 0;
  if (feetChanged) failures.push(`Feet changed (${feetChangedPixels}px)`);

  // Silhouette = alpha-off background must stay clean white vs source.
  let silhouetteChangedPixels = 0;
  const { width, height, channels } = source;
  for (let j = 0; j < width * height; j++) {
    if (alpha.data[j] >= 128) continue;
    const p = j * channels;
    const dr = Math.abs(source.data[p] - variant.data[p]);
    const dg = Math.abs(source.data[p + 1] - variant.data[p + 1]);
    const db = Math.abs(source.data[p + 2] - variant.data[p + 2]);
    if (dr + dg + db > 6) silhouetteChangedPixels++;
  }
  const silhouetteChanged = silhouetteChangedPixels > 40;
  if (silhouetteChanged) failures.push(`Background silhouette drift (${silhouetteChangedPixels}px)`);

  let backgroundContaminatedPixels = 0;
  for (let j = 0; j < width * height; j++) {
    if (alpha.data[j] >= 128) continue;
    const p = j * channels;
    const r = variant.data[p];
    const g = variant.data[p + 1];
    const b = variant.data[p + 2];
    if (
      Math.abs(r - BG_WHITE.r) > 2 ||
      Math.abs(g - BG_WHITE.g) > 2 ||
      Math.abs(b - BG_WHITE.b) > 2
    ) {
      backgroundContaminatedPixels++;
    }
  }
  const backgroundContaminated = backgroundContaminatedPixels > 0;
  if (backgroundContaminated) {
    failures.push(`Background contaminated (${backgroundContaminatedPixels}px)`);
  }

  const bottomSeamRegressionFlag = bottomSeamRegression(base, variant, alpha, legs);
  if (bottomSeamRegressionFlag) failures.push('Bottom seam dark-line regression');

  if (!compare.visuallyMeaningful) failures.push(compare.verdict);

  const meanAbsDeltaL = compare.stats.meanAbsDeltaL;
  const integrityOk =
    !feetChanged && !silhouetteChanged && !backgroundContaminated && !bottomSeamRegressionFlag;
  const visuallyMeaningful = compare.visuallyMeaningful && integrityOk;

  let verdict: string;
  if (visuallyMeaningful) verdict = 'PASS — meaningful upholstery delta with integrity checks';
  else if (failures.length) verdict = `FAIL — ${failures.join('; ')}`;
  else verdict = compare.verdict;

  return {
    feetChanged,
    feetChangedPixels,
    silhouetteChanged,
    silhouetteChangedPixels,
    backgroundContaminated,
    backgroundContaminatedPixels,
    bottomSeamRegression: bottomSeamRegressionFlag,
    meanAbsDeltaL,
    visuallyMeaningful,
    verdict,
    failures,
  };
}

export function scoreVariant(qa: QaArtifactReport, compare: ReturnType<typeof compareUpholsteryImages>): number {
  const integrityFail =
    qa.feetChanged || qa.backgroundContaminated || qa.bottomSeamRegression || qa.silhouetteChanged;
  if (integrityFail) return -1000 + compare.stats.meanAbsDeltaL;
  let score = compare.stats.meanAbsDeltaL * 10 + compare.stats.rmsDeltaL * 5;
  if (compare.visuallyMeaningful) score += 40;
  if (compare.stats.meanAbsDeltaL > 0.35) score += 8;
  if (compare.stats.meanAbsDeltaL > 2.5) score -= 5;
  return score;
}

export async function writeVariantQaOutputs(
  base: RgbaImage,
  variant: RgbaImage,
  upholstery: Mask,
  swatchCode: string,
  variantId: 'A' | 'B' | 'C',
): Promise<{ compare: ReturnType<typeof compareUpholsteryImages>; diffPath: string; heatmapPath: string }> {
  const compare = compareUpholsteryImages(base, variant, upholstery, 2);
  const slug = swatchCode.trim().toUpperCase().replace(/\s+/g, '-');
  const diffPath = qaPath('diff-vs-base', swatchCode).replace(
    `qa-diff-vs-base-${slug}.png`,
    `qa-diff-vs-base-${slug}-variant-${variantId}.png`,
  );
  const heatmapPath = qaPath('diff-heatmap', swatchCode).replace(
    `qa-diff-heatmap-${slug}.png`,
    `qa-diff-heatmap-${slug}-variant-${variantId}.png`,
  );
  mkdirSync(dirname(diffPath), { recursive: true });
  await sharp(compare.diffRgb, { raw: { width: base.width, height: base.height, channels: 3 } })
    .png()
    .toFile(diffPath);
  await sharp(compare.heatmapRgb, { raw: { width: base.width, height: base.height, channels: 3 } })
    .png()
    .toFile(heatmapPath);
  return { compare, diffPath, heatmapPath };
}

export function buildVariantResult(
  id: 'A' | 'B' | 'C',
  label: string,
  path: string,
  applyParams: RealismApplyParams,
  qa: QaArtifactReport,
  compare: ReturnType<typeof compareUpholsteryImages>,
): VariantResult {
  return {
    id,
    label,
    path,
    applyParams,
    qa,
    compare: {
      meanAbsDeltaL: compare.stats.meanAbsDeltaL,
      meanAbsDeltaRgb: compare.stats.meanAbsDeltaRgb,
      ssimOnL: compare.stats.ssimOnL,
      visuallyMeaningful: compare.visuallyMeaningful,
      verdict: compare.verdict,
    },
    score: scoreVariant(qa, compare),
  };
}

export async function writeAggregateQa(
  swatchCode: string,
  base: RgbaImage,
  best: VariantResult | null,
  variants: VariantResult[],
  upholstery: Mask,
): Promise<{ diffPath: string; heatmapPath: string; metricsPath: string }> {
  const diffPath = qaPath('diff-vs-base', swatchCode);
  const heatmapPath = qaPath('diff-heatmap', swatchCode);
  const metricsPath = qaPath('metrics', swatchCode);

  if (best) {
    const bestImg = await loadVariantImage(best.path);
    const compare = compareUpholsteryImages(base, bestImg, upholstery, 1);
    mkdirSync(dirname(diffPath), { recursive: true });
    await sharp(compare.diffRgb, { raw: { width: base.width, height: base.height, channels: 3 } })
      .png()
      .toFile(diffPath);
    await sharp(compare.heatmapRgb, { raw: { width: base.width, height: base.height, channels: 3 } })
      .png()
      .toFile(heatmapPath);
  }

  const variantSpread =
    variants.length >= 2
      ? Math.abs(variants[0].compare.meanAbsDeltaL - variants[variants.length - 1].compare.meanAbsDeltaL)
      : 0;
  const variantsTooClose = variantSpread < 0.35;

  const body = {
    swatchCode,
    bestVariantId: best?.id ?? null,
    variantsTooClose,
    variantSpreadMeanAbsDeltaL: variantSpread,
    variants: variants.map((v) => ({
      id: v.id,
      label: v.label,
      path: v.path,
      score: v.score,
      applyParams: v.applyParams,
      qa: v.qa,
      compare: v.compare,
    })),
    failConditions: {
      noIntegrityPass: !best,
      realismMeaningful: Boolean(best?.compare.visuallyMeaningful),
      trivialOnly: variants.every((v) => !v.compare.visuallyMeaningful),
    },
  };

  writeFileSync(metricsPath, JSON.stringify(body, null, 2));
  return { diffPath, heatmapPath, metricsPath };
}

async function loadVariantImage(path: string): Promise<RgbaImage> {
  const { loadRgba } = await import('../phase1/segment.js');
  return loadRgba(path);
}

export type { RealismVariantSpec };
