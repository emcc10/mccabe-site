import type { ImageRGBA, MaskData } from './types.js';
import type { ProductRenderAssets } from './types.js';
import { join } from 'path';
import { productDir } from './paths.js';
import { loadMask } from './masks.js';
import { cloneImage } from './imageIO.js';

const BG = { r: 255, g: 255, b: 255 };

function supersampleAlphaCoverage(
  alpha: MaskData,
  x: number,
  y: number,
  ss = 4,
): number {
  let inside = 0;
  for (let sy = 0; sy < ss; sy++) {
    for (let sx = 0; sx < ss; sx++) {
      const px = Math.min(alpha.width - 1, Math.floor(x + (sx + 0.5) / ss));
      const py = Math.min(alpha.height - 1, Math.floor(y + (sy + 0.5) / ss));
      if (alpha.data[py * alpha.width + px] >= 128) inside++;
    }
  }
  return inside / (ss * ss);
}

/**
 * Composite using original alpha as silhouette truth. Leg mask overrides upholstery at overlaps.
 */
export async function compositeFinalRender(
  baseImage: ImageRGBA,
  recoloredUpholstery: ImageRGBA,
  assets: ProductRenderAssets,
): Promise<ImageRGBA> {
  const dir = productDir(assets.productCode);
  const alpha = await loadMask(join(dir, 'alpha.png'));
  const upholstery = await loadMask(join(dir, 'upholstery-mask.png'));
  const legs = await loadMask(join(dir, 'leg-mask.png'));
  const trim = await loadMask(join(dir, 'trim-mask.png'));

  const out = cloneImage(baseImage);
  const { width, height, channels } = baseImage;

  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const x = j % width;
    const y = (j / width) | 0;

    if (legs.data[j] >= 128 || trim.data[j] >= 128) {
      out.data[p] = baseImage.data[p];
      out.data[p + 1] = baseImage.data[p + 1];
      out.data[p + 2] = baseImage.data[p + 2];
      if (channels === 4) out.data[p + 3] = baseImage.data[p + 3];
      continue;
    }

    if (upholstery.data[j] >= 128 && alpha.data[j] >= 128) {
      const cov = supersampleAlphaCoverage(alpha, x, y);
      if (cov >= 0.999) {
        out.data[p] = recoloredUpholstery.data[p];
        out.data[p + 1] = recoloredUpholstery.data[p + 1];
        out.data[p + 2] = recoloredUpholstery.data[p + 2];
      } else if (cov > 0.01) {
        out.data[p] = Math.round(recoloredUpholstery.data[p] * cov + BG.r * (1 - cov));
        out.data[p + 1] = Math.round(recoloredUpholstery.data[p + 1] * cov + BG.g * (1 - cov));
        out.data[p + 2] = Math.round(recoloredUpholstery.data[p + 2] * cov + BG.b * (1 - cov));
      } else {
        out.data[p] = BG.r;
        out.data[p + 1] = BG.g;
        out.data[p + 2] = BG.b;
      }
      if (channels === 4) out.data[p + 3] = 255;
      continue;
    }

    if (alpha.data[j] < 128) {
      out.data[p] = BG.r;
      out.data[p + 1] = BG.g;
      out.data[p + 2] = BG.b;
      if (channels === 4) out.data[p + 3] = 255;
    }
  }

  return out;
}
