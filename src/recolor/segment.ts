import { existsSync } from 'fs';
import { join } from 'path';
import type { ImageRGBA, MaskData, SegmentationResult, SingleProductConfig } from './types.js';
import { productDir } from './paths.js';
import {
  cleanupConnectedComponents,
  dilateMask,
  erodeMask,
  intersectMask,
  loadMask,
  maskBoundingBox,
  MASK_OFF,
  MASK_ON,
  saveMask,
  subtractMask,
} from './masks.js';
import { loadImageRGBA } from './imageIO.js';

function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function extractAlphaFromImage(image: ImageRGBA): MaskData {
  const { width, height, channels, data } = image;
  const alpha = new Uint8Array(width * height);
  if (channels === 4) {
    for (let j = 0; j < width * height; j++) {
      const p = j * 4;
      alpha[j] = data[p + 3] >= 128 ? MASK_ON : MASK_OFF;
    }
  } else {
    for (let j = 0; j < width * height; j++) {
      const p = j * channels;
      const L = lum(data[p], data[p + 1], data[p + 2]);
      alpha[j] = L < 248 ? MASK_ON : MASK_OFF;
    }
  }
  return { data: alpha, width, height };
}

export interface RegionScores {
  upholstery: MaskData;
  legs: MaskData;
  trim: MaskData;
}

export function classifyRegions(
  image: ImageRGBA,
  alpha: MaskData,
  config: SingleProductConfig,
): RegionScores {
  const { width, height, channels, data } = image;
  const bb = maskBoundingBox(alpha);
  if (!bb) {
    const empty = new Uint8Array(width * height);
    return {
      upholstery: { data: empty, width, height },
      legs: { data: new Uint8Array(empty), width, height },
      trim: { data: new Uint8Array(empty), width, height },
    };
  }

  const legs = new Uint8Array(width * height);
  const trim = new Uint8Array(width * height);
  const yLegStart = bb.minY + Math.floor((bb.maxY - bb.minY) * 0.62);
  const xRightLeg = bb.minX + Math.floor((bb.maxX - bb.minX) * 0.72);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (alpha.data[j] < 128) continue;
      const p = j * channels;
      const L = lum(data[p], data[p + 1], data[p + 2]);
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);

      const inBottomBand = y >= yLegStart;
      const darkFoot = L < 95 && chroma < 55;
      const rightLegZone = x >= xRightLeg && y >= bb.minY + Math.floor((bb.maxY - bb.minY) * 0.78);

      if (inBottomBand && (darkFoot || rightLegZone)) legs[j] = MASK_ON;

      const woodMetal =
        chroma > 35 &&
        r > g + 12 &&
        L > 40 &&
        L < 160 &&
        y < bb.minY + Math.floor((bb.maxY - bb.minY) * 0.45);
      if (woodMetal) trim[j] = MASK_ON;
    }
  }

  let legMask: MaskData = cleanupConnectedComponents(
    { data: legs, width, height },
    config.minRegionArea,
  );
  legMask = dilateMask(legMask, config.legProtectionExpandPx);

  let trimMask: MaskData = cleanupConnectedComponents(
    { data: trim, width, height },
    Math.max(120, config.minRegionArea >> 1),
  );

  let upholstery = subtractMask(alpha, legMask);
  upholstery = subtractMask(upholstery, trimMask);
  upholstery = cleanupConnectedComponents(upholstery, config.minRegionArea);

  return { upholstery, legs: legMask, trim: trimMask };
}

export function refineMasks(
  alpha: MaskData,
  regions: RegionScores,
  config: SingleProductConfig,
): SegmentationResult {
  let upholstery = regions.upholstery;
  let legs = regions.legs;

  if (config.upholsteryExpandPx > 0) {
    upholstery = erodeMask(upholstery, 0);
    upholstery = dilateMask(upholstery, config.upholsteryExpandPx);
  }
  if (config.upholsteryContractPx > 0) {
    upholstery = erodeMask(upholstery, config.upholsteryContractPx);
  }

  upholstery = subtractMask(upholstery, legs);
  upholstery = subtractMask(upholstery, regions.trim);
  upholstery = intersectMask(upholstery, alpha);

  legs = dilateMask(legs, config.legProtectionExpandPx);
  legs = intersectMask(legs, alpha);
  upholstery = subtractMask(upholstery, legs);

  const trim = intersectMask(regions.trim, alpha);

  return { alpha, upholstery, legs, trim };
}

export async function tryLoadOverrideMasks(
  productCode: string,
  width: number,
  height: number,
): Promise<Partial<SegmentationResult> | null> {
  const dir = productDir(productCode);
  const upPath = join(dir, 'upholstery-mask.override.png');
  const legPath = join(dir, 'leg-mask.override.png');
  const trimPath = join(dir, 'trim-mask.override.png');
  if (!existsSync(upPath)) return null;

  const upholstery = await loadMask(upPath);
  const legs = existsSync(legPath) ? await loadMask(legPath) : null;
  const trim = existsSync(trimPath) ? await loadMask(trimPath) : null;
  if (upholstery.width !== width || upholstery.height !== height) {
    throw new Error('Override mask dimensions do not match source image');
  }
  return {
    upholstery,
    legs: legs ?? undefined,
    trim: trim ?? undefined,
  };
}

export async function autoSegmentSingleProduct(
  baseImage: ImageRGBA,
  config: SingleProductConfig,
): Promise<SegmentationResult> {
  const alpha = extractAlphaFromImage(baseImage);
  const classified = classifyRegions(baseImage, alpha, config);
  return refineMasks(alpha, classified, config);
}

export async function saveSegmentationOutputs(
  productCode: string,
  seg: SegmentationResult,
): Promise<{ alphaPath: string; upholsteryPath: string; legPath: string; trimPath: string }> {
  const dir = productDir(productCode);
  const alphaPath = join(dir, 'alpha.png');
  const upholsteryPath = join(dir, 'upholstery-mask.png');
  const legPath = join(dir, 'leg-mask.png');
  const trimPath = join(dir, 'trim-mask.png');
  await saveMask(alphaPath, seg.alpha);
  await saveMask(upholsteryPath, seg.upholstery);
  await saveMask(legPath, seg.legs);
  await saveMask(trimPath, seg.trim);
  return { alphaPath, upholsteryPath, legPath, trimPath };
}

export async function buildSegmentationForProduct(
  productCode: string,
  sourcePath: string,
  config: SingleProductConfig,
): Promise<SegmentationResult> {
  const image = await loadImageRGBA(sourcePath);
  const overrides = await tryLoadOverrideMasks(productCode, image.width, image.height);
  let seg: SegmentationResult;
  if (overrides?.upholstery) {
    const alpha = extractAlphaFromImage(image);
    const emptyMask: MaskData = {
      data: new Uint8Array(image.width * image.height),
      width: image.width,
      height: image.height,
    };
    let legs = overrides.legs ?? emptyMask;
    const legPath = join(productDir(productCode), 'leg-mask.png');
    if (!overrides.legs && existsSync(legPath)) legs = await loadMask(legPath);
    seg = {
      alpha,
      upholstery: overrides.upholstery,
      legs,
      trim: overrides.trim ?? emptyMask,
    };
    if (overrides.legs) seg.legs = dilateMask(overrides.legs, config.legProtectionExpandPx);
    seg.upholstery = subtractMask(intersectMask(seg.upholstery, alpha), seg.legs);
  } else {
    seg = await autoSegmentSingleProduct(image, config);
  }
  await saveSegmentationOutputs(productCode, seg);
  return seg;
}
