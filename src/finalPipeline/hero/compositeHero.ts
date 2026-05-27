import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import { compositePhase2 } from '../../phase2/composite.js';
import { loadRgba } from '../../phase1/segment.js';
import type { SharedRenderContext } from '../shared/context.js';
import type { RgbaImage } from '../../phase1/segment.js';

/**
 * Lock legs, trim, and background from source after generative upholstery edit.
 * `generativeUpholstery` should be full-size RGBA with edited upholstery pixels.
 */
export function compositeHeroFromGenerative(
  ctx: SharedRenderContext,
  generativeUpholstery: RgbaImage,
): RgbaImage {
  return compositePhase2(
    ctx.source,
    generativeUpholstery,
    ctx.alpha,
    ctx.upholstery,
    ctx.legs,
  );
}

export async function loadGenerativeRgbAsRgba(path: string, width: number, height: number): Promise<RgbaImage> {
  const { data, info } = await sharp(path)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels as 3 | 4,
  };
}

export async function writeHeroRgba(path: string, image: RgbaImage): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}
