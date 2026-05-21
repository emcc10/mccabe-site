/**
 * Masked pixel-diff stats + export gate for Bali production.
 */
import { existsSync, readdirSync } from 'fs';
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

/** Minimum upholstery RMS vs previous final to allow writing a new Bali production PNG. */
export const EXPORT_MIN_UPHOLSTERY_RMS = 3;

const BALI_PRODUCTION_RE = /^Bali-Silk-\d{4}-\d{2}-\d{2}T[\d-]+\.png$/i;

export function findLatestBaliProductionPng(outputDir) {
  if (!outputDir || !existsSync(outputDir)) return null;
  const files = readdirSync(outputDir)
    .filter(
      (f) =>
        BALI_PRODUCTION_RE.test(f) &&
        !f.includes('REALISM-STRESS') &&
        !f.includes('REALISM-PROBE'),
    )
    .sort()
    .reverse();
  return files.length ? join(outputDir, files[0]) : null;
}

export function evaluateBaliExportGate(candidateBuf, previousBuf, mask, width, height, channels) {
  if (!previousBuf) {
    return {
      export: true,
      reason: 'no previous production render to compare',
      stats: null,
    };
  }
  const stats = maskedRgbStats(previousBuf, candidateBuf, mask, width, height, channels);
  const exportOk = stats.rms >= EXPORT_MIN_UPHOLSTERY_RMS;
  return {
    export: exportOk,
    reason: exportOk
      ? `upholstery RMS Δ ${stats.rms} >= ${EXPORT_MIN_UPHOLSTERY_RMS}`
      : `upholstery RMS Δ ${stats.rms} < ${EXPORT_MIN_UPHOLSTERY_RMS} (visually negligible)`,
    stats,
  };
}
