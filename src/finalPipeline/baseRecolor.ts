import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { compositePhase2 } from '../phase2/composite.js';
import { computeUpholsteryLabStats, type RelativeLRemapParams } from '../phase4/recolor.js';
import {
  applyStage4bEdgeFixV3,
  auditStage4bEdgeFix,
  forceFootAdjacentChromaRemap,
  recolorWithStage4bCoverage,
} from '../phase4b/coverage.js';
import { SOURCE_OUT } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import type { SwatchProfile } from './spec.js';
import { baseRecolorPath } from './paths.js';
import { applyPreviewFixV3AtBaseStage, type PreviewFixV3Result } from './preview/previewFixV3.js';

const LIGHTNESS_BANDS = {
  light: { lLow: 72, lHigh: 92, mappedLBlend: 0.82 },
  medium: { lLow: 58, lHigh: 86, mappedLBlend: 0.78 },
  dark: { lLow: 38, lHigh: 72, mappedLBlend: 0.75 },
} as const;

export function profileToRelativeLParams(profile: SwatchProfile): RelativeLRemapParams {
  const band = LIGHTNESS_BANDS[profile.lightnessClass];
  const br = profile.baseRecolor ?? {};
  return {
    lLow: br.lLow ?? band.lLow,
    lHigh: br.lHigh ?? band.lHigh,
    mappedLBlend: br.mappedLBlend ?? band.mappedLBlend,
    targetA: profile.targetLab.a,
    targetB: profile.targetLab.b,
    chromaSourceA: br.chromaSourceA ?? 0.12,
    chromaSourceB: br.chromaSourceB ?? 0.1,
    chromaTargetA: br.chromaTargetA ?? 0.88,
    chromaTargetB: br.chromaTargetB ?? 0.9,
  };
}

/** Reusable swatch-driven base recolor + v3 foot/rail fixes at source stage. */
export async function buildBaseRecolor(profile: SwatchProfile): Promise<{
  image: RgbaImage;
  path: string;
  params: RelativeLRemapParams;
  labStats: ReturnType<typeof computeUpholsteryLabStats>;
  previewFixV3: PreviewFixV3Result;
}> {
  const source = await loadRgba(SOURCE_OUT);
  const { alpha, upholstery, legs } = await loadPhase1Masks(source);
  const params = profileToRelativeLParams(profile);
  const labStats = computeUpholsteryLabStats(source, upholstery);

  const { recolored, masks } = recolorWithStage4bCoverage(
    source,
    upholstery,
    alpha,
    legs,
    params,
    labStats,
  );
  const composited = compositePhase2(source, recolored, alpha, masks.upholsteryRecolor, legs);

  const edgeFix = applyStage4bEdgeFixV3(source, recolored, composited, alpha, legs, masks, params, labStats);
  const footFix = forceFootAdjacentChromaRemap(
    source,
    recolored,
    composited,
    alpha,
    legs,
    masks.footAdjacentUpholstery,
    params,
    labStats,
  );
  const bgTouched = edgeFix.backgroundPixelsTouchedByCleanup + footFix.backgroundPixelsTouchedByCleanup;
  if (bgTouched !== 0) {
    throw new Error(`Coverage remap touched ${bgTouched} background pixels`);
  }

  const edgeAudit = auditStage4bEdgeFix(source, composited, alpha, legs, masks, {
    backgroundPixelsTouchedByCleanup: 0,
  });
  const { image, fix } = await applyPreviewFixV3AtBaseStage(
    source,
    composited,
    recolored,
    alpha,
    upholstery,
    legs,
    masks,
    profile.targetLab,
    edgeAudit,
  );

  if (fix.audit.backgroundPixelsTouchedByCleanup !== 0) {
    throw new Error(`Base recolor touched ${fix.audit.backgroundPixelsTouchedByCleanup} background pixels`);
  }

  const path = baseRecolorPath(profile.code);
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);

  return { image, path, params, labStats, previewFixV3: fix };
}
