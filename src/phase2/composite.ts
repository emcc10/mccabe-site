import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';

const BG = { r: 255, g: 255, b: 255 };

/**
 * Final image: legs + trim areas from source; upholstery from recolor;
 * background white; contour from source alpha.
 */
export function compositePhase2(
  source: RgbaImage,
  recolored: RgbaImage,
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
): RgbaImage {
  const { width, height, channels } = source;
  const out = Buffer.from(source.data);

  for (let j = 0; j < width * height; j++) {
    const p = j * channels;

    if (legs.data[j] >= 128) {
      out[p] = source.data[p];
      out[p + 1] = source.data[p + 1];
      out[p + 2] = source.data[p + 2];
      if (channels === 4) out[p + 3] = source.data[p + 3];
      continue;
    }

    if (upholstery.data[j] >= 128 && alpha.data[j] >= 128) {
      out[p] = recolored.data[p];
      out[p + 1] = recolored.data[p + 1];
      out[p + 2] = recolored.data[p + 2];
      if (channels === 4) out[p + 3] = 255;
      continue;
    }

    if (alpha.data[j] < 128) {
      out[p] = BG.r;
      out[p + 1] = BG.g;
      out[p + 2] = BG.b;
      if (channels === 4) out[p + 3] = 255;
    }
  }

  return { data: out, width, height, channels };
}
