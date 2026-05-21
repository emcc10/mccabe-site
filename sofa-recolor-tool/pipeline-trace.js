/**
 * Masked pixel-diff stats + pipeline stage PNGs (debug only).
 */
import { mkdirSync } from 'fs';
import { join } from 'path';
import { MASK_APPLY_THRESH } from './render-sofas.js';

export function maskedRgbStats(bufA, bufB, mask, width, height, channels) {
  let sumSq = 0;
  let sumAbs = 0;
  let maxAbs = 0;
  let n = 0;
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(bufA[p + c] - bufB[p + c]);
      sumAbs += d;
      sumSq += d * d;
      if (d > maxAbs) maxAbs = d;
      n++;
    }
  }
  const rms = n ? Math.sqrt(sumSq / n) : 0;
  const meanAbs = n ? sumAbs / n : 0;
  return { rms: Math.round(rms * 100) / 100, meanAbs: Math.round(meanAbs * 100) / 100, maxAbs, samples: n };
}

export function formatMaskedStats(label, stats) {
  return `  ${label}: RMS=${stats.rms} mean|Δ|=${stats.meanAbs} max|Δ|=${stats.maxAbs}`;
}
