import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { compositePhase2 } from '../phase2/composite.js';
import { measureRecolorMetrics } from '../phase2/metrics.js';
import { computeUpholsteryLabStats } from '../phase4/recolor.js';
import type { RgbaImage } from '../phase1/segment.js';
import {
  applyStage4bEdgeFixV3,
  assertStage4bEdgeFixComplete,
  auditStage4bEdgeFix,
  buildContourRingPreviewRgb,
  buildEdgeBandPreviewRgb,
  buildFootCornerRingPreviewRgb,
  recolorWithStage4bCoverage,
} from './coverage.js';
import { LOCKED_4B } from './spec.js';

export const STAGE4B_SINGLE = join(DEBUG_DIR, 'stage4b-single.png');
export const STAGE4B_COMPARISON = join(DEBUG_DIR, 'stage4b-comparison.png');
export const STAGE4B_SPEC = join(DEBUG_DIR, 'stage4b-spec.json');

export const STAGE4B_SINGLE_EDGEFIXED_V3 = join(DEBUG_DIR, 'stage4b-single-edgefixed-v3.png');
export const STAGE4B_COMPARISON_EDGEFIXED_V3 = join(DEBUG_DIR, 'stage4b-comparison-edgefixed-v3.png');
export const STAGE4B_CORNER_RING_PREVIEW = join(DEBUG_DIR, 'stage4b-corner-ring-preview.png');
export const STAGE4B_CONTOUR_RING_PREVIEW = join(DEBUG_DIR, 'stage4b-contour-ring-preview.png');
export const STAGE4B_SPEC_EDGEFIXED_V3 = join(DEBUG_DIR, 'stage4b-spec-edgefixed-v3.json');

const LABEL_H = 44;

function labelSvg(text: string, width: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff">${text}</text>
    </svg>`,
  );
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

async function writeRgbPng(path: string, width: number, height: number, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(path);
}

async function panelWithLabel(imagePath: string, label: string): Promise<Buffer> {
  const meta = await sharp(imagePath).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const img = await sharp(imagePath).png().toBuffer();
  return sharp({
    create: { width: w, height: h + LABEL_H, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: img, top: 0, left: 0 },
      { input: labelSvg(label, w), top: h, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function writeTwoPanelComparison(
  outPath: string,
  leftPath: string,
  rightPath: string,
  leftLabel: string,
  rightLabel: string,
) {
  const panels = await Promise.all([
    panelWithLabel(leftPath, leftLabel),
    panelWithLabel(rightPath, rightLabel),
  ]);
  const metas = await Promise.all(panels.map((b) => sharp(b).metadata()));
  const maxH = Math.max(...metas.map((m) => m.height ?? 0), 1);
  const resized = await Promise.all(
    panels.map((buf, i) => {
      const w = metas[i].width ?? 1;
      const h = metas[i].height ?? 1;
      return sharp(buf).resize(Math.round((w * maxH) / h), maxH).toBuffer();
    }),
  );
  const widths = await Promise.all(resized.map((b) => sharp(b).metadata().then((m) => m.width ?? 0)));
  const totalW = widths.reduce((a, b) => a + b, 0);
  await sharp({
    create: { width: totalW, height: maxH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(
      resized.map((input, i) => ({
        input,
        left: widths.slice(0, i).reduce((a, b) => a + b, 0),
        top: 0,
      })),
    )
    .png()
    .toFile(outPath);
}

/** Locked Stage 4B-v3 composite (color + edge cleanup). Used as Stage 5 base. */
export async function buildStage4bV3Final() {
  if (!existsSync(SOURCE_OUT)) {
    throw new Error(`Missing ${SOURCE_OUT} — run npm run prove:stage2 first`);
  }

  const source = await loadRgba(SOURCE_OUT);
  const { alpha, upholstery, legs } = await loadPhase1Masks(source);
  const stats = computeUpholsteryLabStats(source, upholstery);

  const { recolored, masks } = recolorWithStage4bCoverage(
    source,
    upholstery,
    alpha,
    legs,
    LOCKED_4B,
    stats,
  );
  const final = compositePhase2(source, recolored, alpha, masks.upholsteryRecolor, legs);
  const forceResult = applyStage4bEdgeFixV3(
    source,
    recolored,
    final,
    alpha,
    legs,
    masks,
    LOCKED_4B,
    stats,
  );

  const audit = auditStage4bEdgeFix(source, final, alpha, legs, masks, forceResult);
  assertStage4bEdgeFixComplete(audit);

  return { source, base: final, upholstery, alpha, legs, stats, masks, audit };
}

export async function runStage4b() {
  const built = await buildStage4bV3Final();
  const { source, base: final, upholstery, legs, stats, masks, audit } = built;

  await writeRgbaPng(STAGE4B_SINGLE_EDGEFIXED_V3, final);
  await writeTwoPanelComparison(
    STAGE4B_COMPARISON_EDGEFIXED_V3,
    SOURCE_OUT,
    STAGE4B_SINGLE_EDGEFIXED_V3,
    'SOURCE',
    'STAGE 4B EDGE-FIXED',
  );

  await writeRgbPng(
    STAGE4B_CORNER_RING_PREVIEW,
    source.width,
    source.height,
    buildFootCornerRingPreviewRgb(source, masks.footCornerRing),
  );
  await writeRgbPng(
    STAGE4B_CONTOUR_RING_PREVIEW,
    source.width,
    source.height,
    buildContourRingPreviewRgb(source, masks.contourRing),
  );

  await writeRgbaPng(STAGE4B_SINGLE, final);
  await writeTwoPanelComparison(
    STAGE4B_COMPARISON,
    SOURCE_OUT,
    STAGE4B_SINGLE,
    'SOURCE',
    'STAGE 4B SINGLE',
  );

  const metrics = measureRecolorMetrics(source, recolored, final, masks.upholsteryRecolor, legs);
  const { stage, lockedFrom, notFinalBaliSilk, ...params } = LOCKED_4B;

  const specBody = {
    stage,
    lockedFrom,
    notFinalBaliSilk,
    edgeFix: 'v3',
    method:
      'recolorUpholsteryRelativeLRemap + thin contour/foot rings + compositePhase2 + alpha-gated forceRemap',
    params,
    sourceUpholsteryLabStats: stats,
    coverage: {
      edgeExpandPx: 1,
      legRingPx: 1,
      contourRingPx: 1,
      upholsteryNearPx: 2,
      edgeBandPixelCount: countMask(masks.edgeBandOnly),
      footCornerRingPixelCount: countMask(masks.footCornerRing),
      contourRingPixelCount: countMask(masks.contourRing),
      cleanupUnionPixelCount: countMask(masks.cleanupUnion),
      upholsteryRecolorPixelCount: countMask(masks.upholsteryRecolor),
    },
    compositeAudit: {
      bandSourceRgbSurvivors: audit.bandSourceRgbSurvivors,
      cornerSourceRgbSurvivors: audit.cornerSourceRgbSurvivors,
      contourSourceRgbSurvivors: audit.contourSourceRgbSurvivors,
      backgroundPixelsTouchedByCleanup: audit.backgroundPixelsTouchedByCleanup,
      footCornerPixelsTouchedOutsideAlpha: audit.footCornerPixelsTouchedOutsideAlpha,
      contourPixelsTouchedOutsideAlpha: audit.contourPixelsTouchedOutsideAlpha,
      complete: true,
    },
    postRgbPasses: [],
    outputs: {
      single: STAGE4B_SINGLE_EDGEFIXED_V3,
      comparison: STAGE4B_COMPARISON_EDGEFIXED_V3,
      cornerRingPreview: STAGE4B_CORNER_RING_PREVIEW,
      contourRingPreview: STAGE4B_CONTOUR_RING_PREVIEW,
      edgebandPreview: join(DEBUG_DIR, 'stage4b-edgeband-preview.png'),
      legacySingle: STAGE4B_SINGLE,
    },
    metrics: {
      upholsteryMeanLabDeltaFromSource: metrics.upholsteryMeanLabDeltaFromSource,
      lStdPreservationRatio: metrics.lStdPreservationRatio,
      legExactMatchRatio: metrics.legExactMatchRatio,
    },
  };

  writeFileSync(STAGE4B_SPEC_EDGEFIXED_V3, JSON.stringify(specBody, null, 2));
  writeFileSync(STAGE4B_SPEC, JSON.stringify(specBody, null, 2));

  await writeRgbPng(
    join(DEBUG_DIR, 'stage4b-edgeband-preview.png'),
    source.width,
    source.height,
    buildEdgeBandPreviewRgb(source, masks.edgeBandOnly),
  );

  return {
    single: STAGE4B_SINGLE_EDGEFIXED_V3,
    comparison: STAGE4B_COMPARISON_EDGEFIXED_V3,
    spec: STAGE4B_SPEC_EDGEFIXED_V3,
    metrics,
    stats,
    masks,
    audit,
  };
}

function countMask(mask: { data: Uint8Array }): number {
  let n = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] >= 128) n++;
  }
  return n;
}
