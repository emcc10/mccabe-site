import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { buildStage4bV3Final } from '../phase4b/run.js';
import { buildStage4bCoverageMasks } from '../phase4b/coverage.js';
import type { RgbaImage } from '../phase1/segment.js';
import {
  applyBottomSeamCleanup,
  buildBottomSeamDebugRgb,
  buildLower12Region,
} from './bottomSeam.js';

export const PHASE6A_SINGLE = join(DEBUG_DIR, 'phase6a-single.png');
export const PHASE6A_COMPARISON = join(DEBUG_DIR, 'phase6a-comparison.png');
export const PHASE6A_DEBUG = join(DEBUG_DIR, 'phase6a-bottomline-debug.png');
export const PHASE6A_SPEC = join(DEBUG_DIR, 'phase6a-spec.json');

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

/** Stage 4B-v3 composite + bottom-front seam cleanup (compositing only). */
export async function buildPhase6aBase() {
  const { source, base, alpha, upholstery, legs } = await buildStage4bV3Final();
  const coverage = buildStage4bCoverageMasks(alpha, upholstery, legs);
  const { image, cleanupBand, diagnostics } = applyBottomSeamCleanup(
    base,
    alpha,
    upholstery,
    legs,
    coverage,
  );
  const { mask: lower12 } = buildLower12Region(alpha, legs);

  if (diagnostics.backgroundPixelsTouched !== 0) {
    throw new Error(`Phase 6A touched ${diagnostics.backgroundPixelsTouched} background pixels`);
  }

  return {
    source,
    image,
    before6a: base,
    alpha,
    upholstery,
    legs,
    coverage,
    cleanupBand,
    lower12,
    diagnostics,
  };
}

export async function runPhase6a() {
  const built = await buildPhase6aBase();

  await writeRgbaPng(PHASE6A_SINGLE, built.image);
  await writeTwoPanelComparison(
    PHASE6A_COMPARISON,
    SOURCE_OUT,
    PHASE6A_SINGLE,
    'SOURCE',
    'PHASE 6A',
  );
  await writeRgbPng(
    PHASE6A_DEBUG,
    built.image.width,
    built.image.height,
    buildBottomSeamDebugRgb(built.before6a, built.cleanupBand, built.lower12),
  );

  const specBody = {
    phase: '6A',
    purpose: 'Bottom-front compositing seam cleanup (not material realism)',
    input: 'Stage 4B-v3 locked (color + edge cleanup)',
    functionsChanged: [
      'src/phase6a/bottomSeam.ts — buildLower12Region, buildBottomCleanupBandFromImage, applyBottomSeamCleanup',
      'src/phase6a/run.ts — buildPhase6aBase, runPhase6a',
    ],
    seamSources: {
      overlapEdgeBandPx: built.diagnostics.overlapEdgeBandPx,
      overlapContourRingPx: built.diagnostics.overlapContourRingPx,
      overlapOutsideCoreUpholsteryPx: built.diagnostics.overlapOutsideCoreUpholsteryPx,
      note: 'High overlap with edge/contour rings suggests compositing boundary artifact',
    },
    diagnostics: built.diagnostics,
    outputs: {
      single: PHASE6A_SINGLE,
      comparison: PHASE6A_COMPARISON,
      bottomlineDebug: PHASE6A_DEBUG,
    },
  };

  writeFileSync(PHASE6A_SPEC, JSON.stringify(specBody, null, 2));

  return { ...built, spec: PHASE6A_SPEC, single: PHASE6A_SINGLE, comparison: PHASE6A_COMPARISON };
}
