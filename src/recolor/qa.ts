import type { ImageRGBA, MaskData, ProductRenderAssets, QAReport } from './types.js';
import { join } from 'path';
import { productDir } from './paths.js';
import { loadMask, maskBoundingBox } from './masks.js';
import { removeStrayBaseArtifacts, validateContourIntegrity } from './cleanup.js';

function labVariance(image: ImageRGBA, mask: MaskData): number {
  let sumA = 0;
  let sumB = 0;
  let sumSqA = 0;
  let sumSqB = 0;
  let n = 0;
  const ch = image.channels;
  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128) continue;
    const p = j * ch;
    const r = image.data[p] / 255;
    const g = image.data[p + 1] / 255;
    const b = image.data[p + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const a = (r - y) * 500;
    const bVal = (b - y) * 500;
    sumA += a;
    sumB += bVal;
    sumSqA += a * a;
    sumSqB += bVal * bVal;
    n++;
  }
  if (!n) return 0;
  const varA = sumSqA / n - (sumA / n) ** 2;
  const varB = sumSqB / n - (sumB / n) ** 2;
  return varA + varB;
}

export function detectLegBleed(
  finalImage: ImageRGBA,
  upholstery: MaskData,
  legs: MaskData,
): number {
  let bleed = 0;
  let legPx = 0;
  const ch = finalImage.channels;
  for (let j = 0; j < legs.data.length; j++) {
    if (legs.data[j] < 128) continue;
    legPx++;
    if (upholstery.data[j] < 128) continue;
    const p = j * ch;
    const r = finalImage.data[p];
    const g = finalImage.data[p + 1];
    const b = finalImage.data[p + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (y > 120 && y < 230) bleed++;
  }
  return legPx ? bleed / legPx : 0;
}

export function detectDetachedArtifacts(
  finalImage: ImageRGBA,
  alpha: MaskData,
): number {
  const bb = maskBoundingBox(alpha);
  if (!bb) return 0;
  return removeStrayBaseArtifacts(finalImage, alpha, bb.maxY);
}

export function detectContourDrift(finalImage: ImageRGBA, alpha: MaskData): number {
  return validateContourIntegrity(finalImage, alpha).driftRatio;
}

export function detectFlatColorRisk(finalImage: ImageRGBA, upholstery: MaskData): number {
  return labVariance(finalImage, upholstery);
}

export async function runRenderQA(
  baseImage: ImageRGBA,
  finalImage: ImageRGBA,
  assets: ProductRenderAssets,
): Promise<QAReport> {
  const dir = productDir(assets.productCode);
  const upholstery = await loadMask(join(dir, 'upholstery-mask.png'));
  const legs = await loadMask(join(dir, 'leg-mask.png'));
  const alpha = await loadMask(join(dir, 'alpha.png'));

  const legBleedRatio = detectLegBleed(finalImage, upholstery, legs);
  const detachedArtifactCount = detectDetachedArtifacts(finalImage, alpha);
  const contourDriftRatio = detectContourDrift(finalImage, alpha);
  const upholsteryLabVariance = detectFlatColorRisk(finalImage, upholstery);

  const warnings: string[] = [];
  const errors: string[] = [];

  if (!assets.segmentationApproved) {
    warnings.push('Segmentation not approved — review masks before production use.');
  }
  if (legBleedRatio > 0.02) errors.push(`Leg bleed detected (${(legBleedRatio * 100).toFixed(2)}%)`);
  if (contourDriftRatio > 0.08) warnings.push(`Contour drift ${(contourDriftRatio * 100).toFixed(1)}%`);
  if (upholsteryLabVariance < 2.5) warnings.push('Upholstery color variance low — risk of flat/paint look');
  if (detachedArtifactCount > 12) warnings.push(`Removed ${detachedArtifactCount} stray horizontal band pixels`);

  return {
    passed: errors.length === 0,
    warnings,
    errors,
    legBleedRatio,
    detachedArtifactCount,
    contourDriftRatio,
    upholsteryLabVariance,
  };
}
