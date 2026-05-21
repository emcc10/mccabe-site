import type { ImageRGBA, MaskData } from './types.js';

function lum(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function enforceLegExclusion(finalImage: ImageRGBA, baseImage: ImageRGBA, legMask: MaskData): void {
  const { data, channels } = finalImage;
  for (let j = 0; j < legMask.data.length; j++) {
    if (legMask.data[j] < 128) continue;
    const p = j * channels;
    data[p] = baseImage.data[p];
    data[p + 1] = baseImage.data[p + 1];
    data[p + 2] = baseImage.data[p + 2];
    if (channels === 4) data[p + 3] = baseImage.data[p + 3];
  }
}

/** Remove thin horizontal detached fragments in background band below sofa. */
export function removeStrayBaseArtifacts(
  finalImage: ImageRGBA,
  alphaMask: MaskData,
  maxY: number,
): number {
  const { width, height, channels } = finalImage;
  let removed = 0;
  const y0 = maxY + 2;
  const y1 = Math.min(height - 1, maxY + 28);
  for (let y = y0; y <= y1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (alphaMask.data[j] >= 128) continue;
      const p = j * channels;
      if (lum(finalImage.data[p], finalImage.data[p + 1], finalImage.data[p + 2]) > 252) continue;
      const left = lum(
        finalImage.data[(j - 1) * channels],
        finalImage.data[(j - 1) * channels + 1],
        finalImage.data[(j - 1) * channels + 2],
      );
      const right = lum(
        finalImage.data[(j + 1) * channels],
        finalImage.data[(j + 1) * channels + 1],
        finalImage.data[(j + 1) * channels + 2],
      );
      if (left > 250 && right > 250) {
        finalImage.data[p] = 255;
        finalImage.data[p + 1] = 255;
        finalImage.data[p + 2] = 255;
        removed++;
      }
    }
  }
  return removed;
}

export function validateContourIntegrity(
  finalImage: ImageRGBA,
  alphaMask: MaskData,
): { driftRatio: number } {
  let diff = 0;
  let edge = 0;
  const w = alphaMask.width;
  const h = alphaMask.height;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const j = y * w + x;
      const onEdge =
        alphaMask.data[j] >= 128 &&
        (alphaMask.data[j - 1] < 128 ||
          alphaMask.data[j + 1] < 128 ||
          alphaMask.data[j - w] < 128 ||
          alphaMask.data[j + w] < 128);
      if (!onEdge) continue;
      edge++;
      const p = j * finalImage.channels;
      const L = lum(finalImage.data[p], finalImage.data[p + 1], finalImage.data[p + 2]);
      if (L > 248) diff++;
    }
  }
  return { driftRatio: edge ? diff / edge : 0 };
}
