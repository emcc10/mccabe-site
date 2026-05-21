import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import type { ImageRGBA, MaskData } from './types.js';
import { productDir } from './paths.js';
import { loadImageRGBA } from './imageIO.js';
import { loadMask } from './masks.js';

export function productDebugDir(productCode: string): string {
  return join(productDir(productCode), 'debug');
}

async function writePng(path: string, width: number, height: number, channels: number, data: Buffer) {
  mkdirSync(join(path, '..'), { recursive: true });
  await sharp(data, { raw: { width, height, channels } }).png().toFile(path);
}

async function maskWhiteOnBlack(path: string, mask: MaskData) {
  const buf = Buffer.alloc(mask.width * mask.height * 3);
  for (let i = 0; i < mask.data.length; i++) {
    const v = mask.data[i] >= 128 ? 255 : 0;
    const o = i * 3;
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
  }
  await writePng(path, mask.width, mask.height, 3, buf);
}

async function alphaSilhouettePreview(path: string, image: ImageRGBA, alpha: MaskData) {
  const { width, height, channels } = image;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    if (alpha.data[j] < 128) {
      buf[o] = 40;
      buf[o + 1] = 40;
      buf[o + 2] = 48;
    } else {
      buf[o] = image.data[p];
      buf[o + 1] = image.data[p + 1];
      buf[o + 2] = image.data[p + 2];
    }
  }
  await writePng(path, width, height, 3, buf);
}

function overlayMask(
  image: ImageRGBA,
  mask: MaskData,
  r: number,
  g: number,
  b: number,
  alpha: number,
): Buffer {
  const { width, height, channels } = image;
  const buf = Buffer.alloc(width * height * 3);
  const inv = 1 - alpha;
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    const sr = image.data[p];
    const sg = image.data[p + 1];
    const sb = image.data[p + 2];
    if (mask.data[j] >= 128) {
      buf[o] = Math.round(sr * inv + r * alpha);
      buf[o + 1] = Math.round(sg * inv + g * alpha);
      buf[o + 2] = Math.round(sb * inv + b * alpha);
    } else {
      buf[o] = sr;
      buf[o + 1] = sg;
      buf[o + 2] = sb;
    }
  }
  return buf;
}

async function mapGrayscalePreview(path: string, mapPath: string, w: number, h: number) {
  if (!existsSync(mapPath)) return;
  const { data, info } = await sharp(mapPath).greyscale().raw().toBuffer({ resolveWithObject: true });
  const buf = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < data.length; i++) {
    const o = i * 3;
    buf[o] = data[i];
    buf[o + 1] = data[i];
    buf[o + 2] = data[i];
  }
  await writePng(path, info.width, info.height, 3, buf);
}

export interface DebugAssetPaths {
  dir: string;
  sourcePreview: string;
  alphaPreview: string;
  upholsteryMaskPreview: string;
  legMaskPreview: string;
  trimMaskPreview: string;
  upholsteryOverlayPreview: string;
  legOverlayPreview: string;
  combinedOverlayPreview: string;
  detailMapPreview: string;
  shadowMapPreview: string;
  highlightMapPreview: string;
}

export async function writeDebugAssetPreviews(
  productCode: string,
  sourcePath: string,
): Promise<DebugAssetPaths> {
  const dir = productDebugDir(productCode);
  mkdirSync(dir, { recursive: true });

  const image = await loadImageRGBA(sourcePath);
  const base = productDir(productCode);
  const alpha = await loadMask(join(base, 'alpha.png'));
  const upholstery = await loadMask(join(base, 'upholstery-mask.png'));
  const legs = await loadMask(join(base, 'leg-mask.png'));
  const trim = await loadMask(join(base, 'trim-mask.png'));

  const paths: DebugAssetPaths = {
    dir,
    sourcePreview: join(dir, 'source-preview.png'),
    alphaPreview: join(dir, 'alpha-preview.png'),
    upholsteryMaskPreview: join(dir, 'upholstery-mask-preview.png'),
    legMaskPreview: join(dir, 'leg-mask-preview.png'),
    trimMaskPreview: join(dir, 'trim-mask-preview.png'),
    upholsteryOverlayPreview: join(dir, 'upholstery-overlay-preview.png'),
    legOverlayPreview: join(dir, 'leg-overlay-preview.png'),
    combinedOverlayPreview: join(dir, 'combined-overlay-preview.png'),
    detailMapPreview: join(dir, 'detail-map-preview.png'),
    shadowMapPreview: join(dir, 'shadow-map-preview.png'),
    highlightMapPreview: join(dir, 'highlight-map-preview.png'),
  };

  const srcBuf = Buffer.alloc(image.width * image.height * 3);
  for (let j = 0; j < image.width * image.height; j++) {
    const p = j * image.channels;
    const o = j * 3;
    srcBuf[o] = image.data[p];
    srcBuf[o + 1] = image.data[p + 1];
    srcBuf[o + 2] = image.data[p + 2];
  }
  await writePng(paths.sourcePreview, image.width, image.height, 3, srcBuf);

  await alphaSilhouettePreview(paths.alphaPreview, image, alpha);
  await maskWhiteOnBlack(paths.upholsteryMaskPreview, upholstery);
  await maskWhiteOnBlack(paths.legMaskPreview, legs);
  await maskWhiteOnBlack(paths.trimMaskPreview, trim);

  await writePng(
    paths.upholsteryOverlayPreview,
    image.width,
    image.height,
    3,
    overlayMask(image, upholstery, 255, 40, 40, 0.45),
  );
  await writePng(
    paths.legOverlayPreview,
    image.width,
    image.height,
    3,
    overlayMask(image, legs, 40, 80, 255, 0.45),
  );

  let combined = overlayMask(image, upholstery, 255, 40, 40, 0.4);
  const combImg: ImageRGBA = {
    data: Buffer.alloc(image.width * image.height * 3),
    width: image.width,
    height: image.height,
    channels: 3,
  };
  combImg.data = combined;
  combined = overlayMask(combImg, legs, 40, 80, 255, 0.4);
  const combImg2: ImageRGBA = { data: combined, width: image.width, height: image.height, channels: 3 };
  combined = overlayMask(combImg2, trim, 40, 200, 80, 0.35);
  await writePng(paths.combinedOverlayPreview, image.width, image.height, 3, combined);

  await mapGrayscalePreview(paths.detailMapPreview, join(base, 'detail-map.png'), image.width, image.height);
  await mapGrayscalePreview(paths.shadowMapPreview, join(base, 'shadow-map.png'), image.width, image.height);
  await mapGrayscalePreview(paths.highlightMapPreview, join(base, 'highlight-map.png'), image.width, image.height);

  return paths;
}

export async function writeSideBySideComparison(
  outPath: string,
  panels: { label: string; path: string }[],
): Promise<void> {
  const metas = await Promise.all(panels.map((p) => sharp(p.path).metadata()));
  const heights = metas.map((m) => m.height ?? 0);
  const maxH = Math.max(...heights, 1);
  const resized = await Promise.all(
    panels.map((p, i) => {
      const w = metas[i].width ?? 1;
      const h = metas[i].height ?? 1;
      const scale = maxH / h;
      return sharp(p.path)
        .resize(Math.round(w * scale), maxH, { fit: 'fill' })
        .toBuffer();
    }),
  );
  const widths = await Promise.all(resized.map((b) => sharp(b).metadata().then((m) => m.width ?? 0)));
  const totalW = widths.reduce((a, b) => a + b, 0);
  const composites = resized.map((input, i) => ({
    input,
    left: widths.slice(0, i).reduce((a, b) => a + b, 0),
    top: 0,
  }));
  mkdirSync(join(outPath, '..'), { recursive: true });
  await sharp({
    create: { width: totalW, height: maxH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
}
