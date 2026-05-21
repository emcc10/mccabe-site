import sharp from 'sharp';
import type { ImageRGBA } from './types.js';

export async function loadImageRGBA(path: string): Promise<ImageRGBA> {
  const img = sharp(path);
  const meta = await img.metadata();
  const channels = meta.channels === 4 ? 4 : 3;
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

export async function saveImageRGBA(
  path: string,
  image: ImageRGBA,
): Promise<void> {
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

export function cloneImage(image: ImageRGBA): ImageRGBA {
  return {
    data: Buffer.from(image.data),
    width: image.width,
    height: image.height,
    channels: image.channels,
  };
}
