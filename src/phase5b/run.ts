import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { buildStage4bV3Final } from '../phase4b/run.js';
import type { RgbaImage } from '../phase1/segment.js';
import { applyRealismPass, buildSourceTextureMaps } from '../phase5/realism.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import { LOCKED_5B } from './spec.js';

export const STAGE5B_SINGLE = join(DEBUG_DIR, 'stage5b-single.png');
export const STAGE5B_COMPARISON = join(DEBUG_DIR, 'stage5b-comparison.png');
export const STAGE5B_SPEC = join(DEBUG_DIR, 'stage5b-spec.json');

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

export async function runStage5b() {
  const { source, base, upholstery } = await buildStage4bV3Final();
  const maps = buildSourceTextureMaps(source, upholstery, LOCKED_5B.detailBlurPx);
  const baseLab = meanUpholsteryLab(base, upholstery);

  const final = applyRealismPass(base, source, upholstery, maps, {
    detailStrength: LOCKED_5B.detailStrength,
    highlightStrength: LOCKED_5B.highlightStrength,
    aVarAmp: LOCKED_5B.aVariationAmplitude,
    bVarAmp: LOCKED_5B.bVariationAmplitude,
  });

  await writeRgbaPng(STAGE5B_SINGLE, final);
  await writeTwoPanelComparison(
    STAGE5B_COMPARISON,
    SOURCE_OUT,
    STAGE5B_SINGLE,
    'SOURCE',
    'STAGE 5B SINGLE',
  );

  const outLab = meanUpholsteryLab(final, upholstery);

  writeFileSync(
    STAGE5B_SPEC,
    JSON.stringify(
      {
        ...LOCKED_5B,
        method:
          'Stage 4B-v3 base + realism pass (detail + highlight + micro a/b, upholstery mask only)',
        realismParams: {
          detailStrength: LOCKED_5B.detailStrength,
          highlightStrength: LOCKED_5B.highlightStrength,
          aVariationAmplitude: LOCKED_5B.aVariationAmplitude,
          bVariationAmplitude: LOCKED_5B.bVariationAmplitude,
          detailBlurPx: LOCKED_5B.detailBlurPx,
        },
        baseUpholsteryMeanLab: baseLab,
        outputUpholsteryMeanLab: outLab,
        deltaMeanLFromBase: outLab.meanL - baseLab.meanL,
        postRgbPasses: [],
        outputs: { single: STAGE5B_SINGLE, comparison: STAGE5B_COMPARISON },
      },
      null,
      2,
    ),
  );

  return { single: STAGE5B_SINGLE, comparison: STAGE5B_COMPARISON, spec: STAGE5B_SPEC, baseLab, outLab };
}
