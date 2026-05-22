import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';
import { applyMaterialModel, buildMaterialMaps } from './materialModel.js';
import { LOCKED_7B, LOCKED_7B_PARAMS } from './spec.js';

export const PHASE7_SINGLE_B = join(DEBUG_DIR, 'phase7-single-B.png');
export const PHASE7_COMPARISON_B = join(DEBUG_DIR, 'phase7-comparison-B.png');
export const PHASE7_SPEC_SINGLE_B = join(DEBUG_DIR, 'phase7-spec-single-B.json');

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

export async function buildLocked7bSingle() {
  const { source, image: base6a, upholstery } = await buildPhase6aBase();
  const maps = buildMaterialMaps(source, upholstery);
  const image = applyMaterialModel(base6a, upholstery, maps, LOCKED_7B_PARAMS);
  return { source, image, base6a, upholstery, maps };
}

export async function runPhase7SingleB() {
  const { image, base6a, upholstery } = await buildLocked7bSingle();
  const base6aLab = meanUpholsteryLab(base6a, upholstery);
  const outLab = meanUpholsteryLab(image, upholstery);

  await writeRgbaPng(PHASE7_SINGLE_B, image);
  await writeTwoPanelComparison(
    PHASE7_COMPARISON_B,
    SOURCE_OUT,
    PHASE7_SINGLE_B,
    'SOURCE',
    'PHASE 7 SINGLE B',
  );

  writeFileSync(
    PHASE7_SPEC_SINGLE_B,
    JSON.stringify(
      {
        ...LOCKED_7B,
        method: 'Phase 6A + applyMaterialModel (locked 7B); upholstery mask only',
        materialParams: LOCKED_7B_PARAMS,
        upholsteryMeanLab: { base6a: base6aLab, output: outLab },
        deltaMeanLFrom6a: outLab.meanL - base6aLab.meanL,
        postRgbPasses: [],
        outputs: { single: PHASE7_SINGLE_B, comparison: PHASE7_COMPARISON_B },
      },
      null,
      2,
    ),
  );

  return {
    single: PHASE7_SINGLE_B,
    comparison: PHASE7_COMPARISON_B,
    spec: PHASE7_SPEC_SINGLE_B,
    outLab,
    base6aLab,
  };
}
