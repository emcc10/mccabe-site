import { LOCKED_4B } from '../phase4b/spec.js';
import { LOCKED_7B_PARAMS } from '../phase7/spec.js';
import { LOCKED_7C_B, LOCKED_7C_B_BOOST } from './spec.js';

/** Zone definition mirrored from upperRegion.ts (keep in sync if zones change). */
export const UPPER_REGION_ZONE_DEF = {
  back: { yMax: 0.46, xMin: 0.18, xMax: 0.82 },
  arms: { xOuterMax: 0.26, xInnerMin: 0.74, yMin: 0.18, yMax: 0.66 },
  seatFront: { yMin: 0.34, yMax: 0.58 },
  lower12DilatePx: 8,
  upholBottomExcludeFrac: 0.16,
  featherBlurPx: 14,
} as const;

export function buildPreviewLockedParams() {
  const {
    lLow,
    lHigh,
    mappedLBlend,
    targetA,
    targetB,
    chromaSourceA,
    chromaSourceB,
    chromaTargetA,
    chromaTargetB,
  } = LOCKED_4B;

  return {
    productCode: 'TEST-SOFA',
    swatch: 'BALI-SILK',
    lockedVersion: '7C-B',
    frozenAt: new Date().toISOString().slice(0, 10),
    pipelineStatus: LOCKED_7C_B.pipelineStatus,
    iterationFrozen: true,
    notFinalCatalogPhoto: true,
    regenerateScript: 'npm run export:preview-locked',
    renderScript: 'npm run render:phase7c-b',
    pipeline: LOCKED_7C_B.pipeline,
    stage4bV3: {
      lLow,
      lHigh,
      mappedLBlend,
      targetA,
      targetB,
      chromaSourceA,
      chromaSourceB,
      chromaTargetA,
      chromaTargetB,
      edgeFix: 'v3 thin rings (edge band, foot corner ring, contour ring)',
    },
    phase6a: {
      purpose: 'Bottom-front compositing seam cleanup only',
      lowerBandFrac: 0.12,
    },
    phase7b: LOCKED_7B_PARAMS,
    phase7cB: {
      upperRegionOnly: true,
      regionalBoost: LOCKED_7C_B_BOOST,
      noSeamIncrease: true,
      upperRegionZones: UPPER_REGION_ZONE_DEF,
    },
    unchanged: [
      'masks',
      'alpha',
      'leg restore',
      'no edge changes',
      'no color remap sweeps',
      'no random noise',
      'no global sharpen',
    ],
  };
}
