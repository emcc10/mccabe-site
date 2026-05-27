import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import type { Mask } from '../../phase1/masks.js';
import type { RgbaImage } from '../../phase1/segment.js';
import {
  assertStage4bEdgeFixComplete,
  buildFootAdjacentPreviewRgb,
  buildOwnershipDebugRgb,
  type Stage4bCoverageMasks,
  type Stage4bEdgeFixAudit,
} from '../../phase4b/coverage.js';
import { intersect, subtract } from '../../phase1/masks.js';
import { applyBottomSeamCleanup } from '../../phase6a/bottomSeam.js';
import {
  previewFixSpecV3Path,
  previewFootAdjacentZoneDebugPath,
  previewBottomRailRegionDebugPath,
  previewOwnershipDebugPath,
} from '../paths.js';
import {
  applyFrontRailSeamAttenuation,
  buildFrontRailDebugRgb,
  buildFrontRailRegion,
  buildFrontRailSeamBand,
} from './frontRailSeam.js';

export interface PreviewFixV3Result {
  frontRailSeamPixels: number;
  footAdjacentPixels: number;
  footAdjacentSourceSurvivors: number;
  debugPaths: {
    bottomRail: string;
    footAdjacent: string;
    ownership: string;
    spec: string;
  };
  audit: Stage4bEdgeFixAudit;
}

export async function applyPreviewFixV3AtBaseStage(
  source: RgbaImage,
  composited: RgbaImage,
  recolored: RgbaImage,
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
  masks: Stage4bCoverageMasks,
  targetLab: { l: number; a: number; b: number },
  edgeAudit: Stage4bEdgeFixAudit,
): Promise<{ image: RgbaImage; fix: PreviewFixV3Result }> {
  const bottomResult = applyBottomSeamCleanup(composited, alpha, upholstery, legs, masks);

  const frontRail = buildFrontRailRegion(alpha, legs);
  const { band: detectedBand, weights } = buildFrontRailSeamBand(bottomResult.image, frontRail);
  const frontRailSeamBand = detectedBand;
  const nonLeg = subtract(alpha, legs);
  for (let i = 0; i < frontRail.data.length; i++) {
    if (frontRail.data[i] < 128 || bottomResult.cleanupBand.data[i] < 128) continue;
    if (nonLeg.data[i] < 128) continue;
    if (weights[i] < 0.2) weights[i] = 0.32;
    frontRailSeamBand.data[i] = 255;
  }
  const railPass = applyFrontRailSeamAttenuation(
    bottomResult.image,
    weights,
    alpha,
    legs,
    targetLab,
  );

  const audit = edgeAudit;
  assertStage4bEdgeFixComplete(audit);

  const debugPaths = {
    bottomRail: previewBottomRailRegionDebugPath(),
    footAdjacent: previewFootAdjacentZoneDebugPath(),
    ownership: previewOwnershipDebugPath(),
    spec: previewFixSpecV3Path(),
  };

  mkdirSync(dirname(debugPaths.bottomRail), { recursive: true });
  const { width, height } = source;

  await sharp(buildFrontRailDebugRgb(source, frontRailSeamBand), {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toFile(debugPaths.bottomRail);

  await sharp(buildFootAdjacentPreviewRgb(source, masks.footAdjacentUpholstery), {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toFile(debugPaths.footAdjacent);

  await sharp(buildOwnershipDebugRgb(source, legs, masks.footAdjacentUpholstery, frontRailSeamBand), {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toFile(debugPaths.ownership);

  const fix: PreviewFixV3Result = {
    frontRailSeamPixels: railPass.pixelsTouched,
    footAdjacentPixels: countMask(masks.footAdjacentUpholstery),
    footAdjacentSourceSurvivors: audit.footAdjacentSourceRgbSurvivors,
    debugPaths,
    audit,
  };

  const spec = {
    pass: 'preview-pipeline-v3-base-stage',
    frontRail: {
      regionPixels: countMask(frontRail),
      seamBandPixels: countMask(frontRailSeamBand),
      attenuationPixels: railPass.pixelsTouched,
      bottomSeamBandPixels: bottomResult.diagnostics.cleanupBandPixelCount,
    },
    footAdjacent: {
      ringPixels: fix.footAdjacentPixels,
      sourceRgbSurvivors: fix.footAdjacentSourceSurvivors,
    },
    edgeFixAudit: audit,
  };
  writeFileSync(debugPaths.spec, JSON.stringify(spec, null, 2));

  return { image: railPass.image, fix };
}

function countMask(m: Mask): number {
  let n = 0;
  for (let i = 0; i < m.data.length; i++) if (m.data[i] >= 128) n++;
  return n;
}

