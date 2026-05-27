import sharp from 'sharp';
import type { Mask } from '../../phase1/masks.js';

export const OPENAI_EDIT_SIZE = 1024;

export interface EditCanvasMapping {
  sourceWidth: number;
  sourceHeight: number;
  canvasSize: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  scaledWidth: number;
  scaledHeight: number;
}

export function computeEditCanvasMapping(width: number, height: number): EditCanvasMapping {
  const canvasSize = OPENAI_EDIT_SIZE;
  const scale = Math.min(canvasSize / width, canvasSize / height);
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);
  const offsetX = Math.floor((canvasSize - scaledWidth) / 2);
  const offsetY = Math.floor((canvasSize - scaledHeight) / 2);
  return {
    sourceWidth: width,
    sourceHeight: height,
    canvasSize,
    scale,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight,
  };
}

/** Letterbox image to 1024×1024 white canvas for OpenAI edits API. */
export async function letterboxToEditCanvas(imagePath: string, mapping: EditCanvasMapping): Promise<Buffer> {
  const scaled = await sharp(imagePath)
    .resize(mapping.scaledWidth, mapping.scaledHeight, { fit: 'fill' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: mapping.canvasSize,
      height: mapping.canvasSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: scaled, left: mapping.offsetX, top: mapping.offsetY }])
    .png()
    .toBuffer();
}

/**
 * OpenAI edit mask: transparent = replace (upholstery), opaque = preserve.
 * RGB white + alpha 0 on upholstery, alpha 255 elsewhere.
 */
export async function buildOpenAiEditMaskPng(
  upholstery: Mask,
  mapping: EditCanvasMapping,
): Promise<Buffer> {
  const { width, height } = upholstery;
  const rgba = Buffer.alloc(width * height * 4);
  for (let j = 0; j < width * height; j++) {
    const o = j * 4;
    rgba[o] = 255;
    rgba[o + 1] = 255;
    rgba[o + 2] = 255;
    const edit = upholstery.data[j] >= 128;
    rgba[o + 3] = edit ? 0 : 255;
  }

  const scaled = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .resize(mapping.scaledWidth, mapping.scaledHeight, { fit: 'fill' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: mapping.canvasSize,
      height: mapping.canvasSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: scaled, left: mapping.offsetX, top: mapping.offsetY }])
    .png()
    .toBuffer();
}

/** Crop letterboxed API result back to source dimensions. */
export async function cropEditCanvasToSource(
  canvasPng: Buffer,
  mapping: EditCanvasMapping,
): Promise<Buffer> {
  return sharp(canvasPng)
    .extract({
      left: mapping.offsetX,
      top: mapping.offsetY,
      width: mapping.scaledWidth,
      height: mapping.scaledHeight,
    })
    .resize(mapping.sourceWidth, mapping.sourceHeight, { fit: 'fill' })
    .png()
    .toBuffer();
}
