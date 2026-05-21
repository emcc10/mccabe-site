import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { applyRealismPassV2, buildSourceTextureMapsV2 } from '../phase6b/realismV2.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import { LOCKED_6C_B, LOCKED_6C_B_PARAMS } from './spec.js';

export const PHASE6C_SINGLE_B = join(DEBUG_DIR, 'phase6c-single-B.png');
export const PHASE6C_COMPARISON_B = join(DEBUG_DIR, 'phase6c-comparison-B.png');
export const PHASE6C_SPEC_SINGLE_B = join(DEBUG_DIR, 'phase6c-spec-single-B.json');

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

/** Phase 6A + locked 6C-B realism (single review candidate). */
export async function buildLocked6cBSingle() {
  const { source, image: base6a, upholstery } = await buildPhase6aBase();
  const maps = buildSourceTextureMapsV2(
    source,
    upholstery,
    LOCKED_6C_B_PARAMS.fineBlurPx,
    LOCKED_6C_B_PARAMS.coarseBlurPx,
  );
  const image = applyRealismPassV2(base6a, upholstery, maps, LOCKED_6C_B_PARAMS);
  return { source, image, base6a, upholstery, maps };
}

export async function runPhase6cSingleB() {
  const { image, base6a, upholstery } = await buildLocked6cBSingle();
  const base6aLab = meanUpholsteryLab(base6a, upholstery);
  const outLab = meanUpholsteryLab(image, upholstery);

  await writeRgbaPng(PHASE6C_SINGLE_B, image);
  await writeTwoPanelComparison(
    PHASE6C_COMPARISON_B,
    SOURCE_OUT,
    PHASE6C_SINGLE_B,
    'SOURCE',
    'PHASE 6C SINGLE B',
  );

  writeFileSync(
    PHASE6C_SPEC_SINGLE_B,
    JSON.stringify(
      {
        ...LOCKED_6C_B,
        method: 'Phase 6A + applyRealismPassV2 (locked 6C-B params); upholstery mask only',
        realismParams: LOCKED_6C_B_PARAMS,
        upholsteryMeanLab: { base6a: base6aLab, output: outLab },
        deltaMeanLFrom6a: outLab.meanL - base6aLab.meanL,
        postRgbPasses: [],
        outputs: { single: PHASE6C_SINGLE_B, comparison: PHASE6C_COMPARISON_B },
      },
      null,
      2,
    ),
  );

  return {
    single: PHASE6C_SINGLE_B,
    comparison: PHASE6C_COMPARISON_B,
    spec: PHASE6C_SPEC_SINGLE_B,
    outLab,
    base6aLab,
  };
}
