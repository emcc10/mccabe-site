/**
 * Mandatory 6-panel Bali debug strip.
 */
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';

/**
 * @param {Buffer[]} panels — [source, previous, new, contourAlpha, detail, seam]
 */
export async function writeBaliDebugStrip6(panels, width, height, channels, outPath) {
  const count = panels.length;
  const stripW = width * count;
  const strip = Buffer.alloc(stripW * height * channels);
  for (let y = 0; y < height; y++) {
    for (let col = 0; col < count; col++) {
      const panel = panels[col];
      for (let x = 0; x < width; x++) {
        const sj = y * width + x;
        const dj = y * stripW + col * width + x;
        const sp = sj * channels;
        const dp = dj * channels;
        strip[dp] = panel[sp];
        strip[dp + 1] = panel[sp + 1];
        strip[dp + 2] = panel[sp + 2];
        if (channels === 4) strip[dp + 3] = panel[sp + 3] ?? 255;
      }
    }
  }
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(strip, { raw: { width: stripW, height, channels } }).png().toFile(outPath);
  return outPath;
}

/** @deprecated use writeBaliDebugStrip6 */
export async function writeBaliDebugStrip(panels, width, height, channels, outPath) {
  return writeBaliDebugStrip6(panels, width, height, channels, outPath);
}
