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
  applyCoverageBandsToFinal,
  buildEdgeBandPreviewRgb,
  buildFootRingPreviewRgb,
  countBandSourceRgbSurvivors,
  recolorWithStage4bCoverage,
} from './coverage.js';
import { LOCKED_4B } from './spec.js';

export const STAGE4B_SINGLE = join(DEBUG_DIR, 'stage4b-single.png');
export const STAGE4B_COMPARISON = join(DEBUG_DIR, 'stage4b-comparison.png');
export const STAGE4B_SPEC = join(DEBUG_DIR, 'stage4b-spec.json');

export const STAGE4B_EDGEBAND_PREVIEW = join(DEBUG_DIR, 'stage4b-edgeband-preview.png');
export const STAGE4B_FOOT_RING_PREVIEW = join(DEBUG_DIR, 'stage4b-foot-ring-preview.png');
export const STAGE4B_SINGLE_EDGEFIXED = join(DEBUG_DIR, 'stage4b-single-edgefixed.png');
export const STAGE4B_COMPARISON_EDGEFIXED = join(DEBUG_DIR, 'stage4b-comparison-edgefixed.png');
export const STAGE4B_SPEC_EDGEFIXED = join(DEBUG_DIR, 'stage4b-spec-edgefixed.json');

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

export async function runStage4b() {
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
  applyCoverageBandsToFinal(
    source,
    recolored,
    final,
    alpha,
    legs,
    masks.edgeBandOnly,
    masks.footRing,
  );

  const bandSurvivors = countBandSourceRgbSurvivors(
    source,
    final,
    legs,
    masks.edgeBandOnly,
    masks.footRing,
  );

  await writeRgbaPng(STAGE4B_SINGLE_EDGEFIXED, final);
  await writeTwoPanelComparison(
    STAGE4B_COMPARISON_EDGEFIXED,
    SOURCE_OUT,
    STAGE4B_SINGLE_EDGEFIXED,
    'SOURCE',
    'STAGE 4B EDGE-FIXED',
  );

  await writeRgbPng(
    STAGE4B_EDGEBAND_PREVIEW,
    source.width,
    source.height,
    buildEdgeBandPreviewRgb(source, masks.edgeBandOnly),
  );
  await writeRgbPng(
    STAGE4B_FOOT_RING_PREVIEW,
    source.width,
    source.height,
    buildFootRingPreviewRgb(source, masks.footRing),
  );

  // Legacy filenames alias edge-fixed (same pipeline)
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
    edgeFix: true,
    method: 'recolorUpholsteryRelativeLRemap + edge/foot coverage + compositePhase2',
    params,
    sourceUpholsteryLabStats: stats,
    coverage: {
      edgeExpandPx: 1,
      footGuardPx: 1,
      edgeBandPixelCount: countMask(masks.edgeBandOnly),
      footRingPixelCount: countMask(masks.footRing),
      upholsteryRecolorPixelCount: countMask(masks.upholsteryRecolor),
    },
    compositeAudit: {
      bandSourceRgbSurvivors: bandSurvivors,
      note: 'Trim/frame inside alpha intentionally keeps source; band survivors must be 0',
    },
    postRgbPasses: [],
    outputs: {
      single: STAGE4B_SINGLE_EDGEFIXED,
      comparison: STAGE4B_COMPARISON_EDGEFIXED,
      edgebandPreview: STAGE4B_EDGEBAND_PREVIEW,
      footRingPreview: STAGE4B_FOOT_RING_PREVIEW,
      legacySingle: STAGE4B_SINGLE,
      legacyComparison: STAGE4B_COMPARISON,
    },
    metrics: {
      upholsteryMeanLabDeltaFromSource: metrics.upholsteryMeanLabDeltaFromSource,
      lStdPreservationRatio: metrics.lStdPreservationRatio,
      legExactMatchRatio: metrics.legExactMatchRatio,
    },
  };

  writeFileSync(STAGE4B_SPEC_EDGEFIXED, JSON.stringify(specBody, null, 2));
  writeFileSync(STAGE4B_SPEC, JSON.stringify(specBody, null, 2));

  return {
    single: STAGE4B_SINGLE_EDGEFIXED,
    comparison: STAGE4B_COMPARISON_EDGEFIXED,
    spec: STAGE4B_SPEC_EDGEFIXED,
    metrics,
    stats,
    masks,
    bandSurvivors,
  };
}

function countMask(mask: { data: Uint8Array }): number {
  let n = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] >= 128) n++;
  }
  return n;
}
