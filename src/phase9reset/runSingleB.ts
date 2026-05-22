import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { buildLower12Region } from '../phase6a/bottomSeam.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { BALI_SILK_SWATCH, DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { loadImageRGBA } from '../recolor/imageIO.js';
import { buildBottomGuard, buildSwatchMaterialWeight } from '../phase9/materialWeight.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { applyCleanSwatchMaterial } from './apply.js';
import { LOCKED_9RESET_B_PARAMS } from './spec.js';
import { buildCleanSwatchMaterial } from './swatchSanitize.js';

export const PHASE9RESET_SINGLE_B = join(DEBUG_DIR, 'phase9reset-single-B.png');
export const PHASE9RESET_COMPARISON_B = join(DEBUG_DIR, 'phase9reset-comparison-B.png');

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

export async function buildLocked9resetBSingle() {
  const { source, image: base6a, upholstery, alpha, legs } = await buildPhase6aBase();
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const swatchImage = await loadImageRGBA(BALI_SILK_SWATCH);
  const clean = buildCleanSwatchMaterial(swatchImage);
  const gates = buildSourceStructureGates(source, upholstery);
  const materialWeight = buildSwatchMaterialWeight(upholstery, gates, bottomGuard);
  const image = applyCleanSwatchMaterial(
    base6a,
    upholstery,
    clean,
    gates,
    materialWeight,
    LOCKED_9RESET_B_PARAMS,
  );
  return { image };
}

export async function runPhase9resetSingleB() {
  const { image } = await buildLocked9resetBSingle();

  await writeRgbaPng(PHASE9RESET_SINGLE_B, image);
  await writeTwoPanelComparison(
    PHASE9RESET_COMPARISON_B,
    SOURCE_OUT,
    PHASE9RESET_SINGLE_B,
    'SOURCE',
    'PHASE 9RESET SINGLE B',
  );

  return { single: PHASE9RESET_SINGLE_B, comparison: PHASE9RESET_COMPARISON_B };
}
