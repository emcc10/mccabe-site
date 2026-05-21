/**
 * Mandatory 4-panel Bali debug strip for pipeline verification.
 */
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';

/**
 * @param {Buffer[]} panels — [source, previousOutput, newOutput, detailViz]
 */
export async function writeBaliDebugStrip(panels, width, height, channels, outPath) {
  const stripW = width * 4;
  const strip = Buffer.alloc(stripW * height * channels);
  for (let y = 0; y < height; y++) {
    for (let col = 0; col < 4; col++) {
      const panel = panels[col] ?? panels[0];
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
