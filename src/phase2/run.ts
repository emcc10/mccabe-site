import { existsSync, mkdirSync } from 'fs';
import sharp from 'sharp';
import { DEBUG_DIR, LEGACY_UPHOLSTERY_MASK, SOURCE_OUT } from '../phase1/paths.js';
import { buildPhase1Masks, loadMaskPng, loadRgba } from '../phase1/segment.js';
import { writeCombinedOverlay } from '../phase1/previews.js';
import {
  BALI_SILK_LAB,
  CHROMA_BLEND,
  PHASE2_COMPARISON_OUT,
  PHASE2_RECOLOR_OUT,
  PRESERVE_LUMINANCE,
} from './paths.js';
import { compositePhase2 } from './composite.js';
import { recolorUpholsteryMinimal } from './recolor.js';

export interface Phase2Outputs {
  recolor: string;
  comparison: string;
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(DEBUG_DIR, { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

async function writeComparison(
  outPath: string,
  sourcePath: string,
  overlayPath: string,
  renderPath: string,
) {
  const panels = [sourcePath, overlayPath, renderPath];
  const metas = await Promise.all(panels.map((p) => sharp(p).metadata()));
  const maxH = Math.max(...metas.map((m) => m.height ?? 0), 1);
  const resized = await Promise.all(
    panels.map((p, i) => {
      const w = metas[i].width ?? 1;
      const h = metas[i].height ?? 1;
      return sharp(p).resize(Math.round((w * maxH) / h), maxH).toBuffer();
    }),
  );
  const widths = await Promise.all(resized.map((b) => sharp(b).metadata().then((m) => m.width ?? 0)));
  const totalW = widths.reduce((a, b) => a + b, 0);
  const composites = resized.map((input, i) => ({
    input,
    left: widths.slice(0, i).reduce((a, b) => a + b, 0),
    top: 0,
  }));
  await sharp({
    create: { width: totalW, height: maxH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
}

export async function runPhase2(): Promise<Phase2Outputs> {
  if (!existsSync(SOURCE_OUT)) {
    throw new Error(`Run Phase 1 first — missing ${SOURCE_OUT}`);
  }

  const source = await loadRgba(SOURCE_OUT);
  const handUpholstery = await loadMaskPng(LEGACY_UPHOLSTERY_MASK, source.width, source.height);
  const { alpha, upholstery, legs } = buildPhase1Masks(source, handUpholstery);

  const recolored = recolorUpholsteryMinimal(
    source,
    upholstery,
    BALI_SILK_LAB,
    PRESERVE_LUMINANCE,
    CHROMA_BLEND,
  );
  const final = compositePhase2(source, recolored, alpha, upholstery, legs);

  await writeRgbaPng(PHASE2_RECOLOR_OUT, final);

  const overlayTmp = `${DEBUG_DIR}/_phase2-overlay-tmp.png`;
  await writeCombinedOverlay(overlayTmp, source, upholstery, legs);
  await writeComparison(PHASE2_COMPARISON_OUT, SOURCE_OUT, overlayTmp, PHASE2_RECOLOR_OUT);

  return { recolor: PHASE2_RECOLOR_OUT, comparison: PHASE2_COMPARISON_OUT };
}
