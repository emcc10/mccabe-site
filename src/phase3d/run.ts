import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { compositePhase2 } from '../phase2/composite.js';
import { measureRecolorMetrics } from '../phase2/metrics.js';
import { recolorUpholsteryMinimal } from '../phase2/recolor.js';
import type { RgbaImage } from '../phase1/segment.js';
import { LOCKED_J } from './spec.js';

export const STAGE3D_SINGLE = join(DEBUG_DIR, 'stage3d-single-J.png');
export const STAGE3D_COMPARISON = join(DEBUG_DIR, 'stage3d-comparison-J.png');
export const STAGE3D_SPEC = join(DEBUG_DIR, 'stage3d-spec.json');

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
  mkdirSync(DEBUG_DIR, { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
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

export async function runStage3d() {
  if (!existsSync(SOURCE_OUT)) {
    throw new Error(`Missing ${SOURCE_OUT} — run npm run prove:stage2 first`);
  }

  const source = await loadRgba(SOURCE_OUT);
  const { alpha, upholstery, legs } = await loadPhase1Masks(source);

  const recolored = recolorUpholsteryMinimal(
    source,
    upholstery,
    LOCKED_J.targetLab,
    LOCKED_J.preserveLuminance,
    LOCKED_J.chromaBlend,
  );
  const final = compositePhase2(source, recolored, alpha, upholstery, legs);

  await writeRgbaPng(STAGE3D_SINGLE, final);
  await writeTwoPanelComparison(STAGE3D_COMPARISON, SOURCE_OUT, STAGE3D_SINGLE, 'SOURCE', 'STAGE 3D SINGLE J');

  const metrics = measureRecolorMetrics(source, recolored, final, upholstery, legs);
  writeFileSync(
    STAGE3D_SPEC,
    JSON.stringify(
      {
        ...LOCKED_J,
        pipeline: 'recolorUpholsteryMinimal + compositePhase2',
        postRgbPasses: [],
        outputs: { single: STAGE3D_SINGLE, comparison: STAGE3D_COMPARISON },
        metrics: {
          upholsteryMeanLabDeltaFromSource: metrics.upholsteryMeanLabDeltaFromSource,
          lStdPreservationRatio: metrics.lStdPreservationRatio,
          legExactMatchRatio: metrics.legExactMatchRatio,
        },
      },
      null,
      2,
    ),
  );

  return { single: STAGE3D_SINGLE, comparison: STAGE3D_COMPARISON, spec: STAGE3D_SPEC, metrics };
}
