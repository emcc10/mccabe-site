import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import { loadPhase1Masks } from '../phase1/loadMasks.js';
import { loadRgba } from '../phase1/segment.js';
import { writeAlphaPreview, writeCombinedOverlay, writeMaskPreview } from '../phase1/previews.js';
import { SOURCE_OUT } from '../phase1/paths.js';
import { finalPath } from './paths.js';

export interface PrepResult {
  source: Awaited<ReturnType<typeof loadRgba>>;
  alpha: Awaited<ReturnType<typeof loadPhase1Masks>>['alpha'];
  upholstery: Awaited<ReturnType<typeof loadPhase1Masks>>['upholstery'];
  legs: Awaited<ReturnType<typeof loadPhase1Masks>>['legs'];
  paths: {
    sourceClean: string;
    upholsteryMask: string;
    legMask: string;
    alphaMask: string;
    prepDebugOverlay: string;
  };
  validation: {
    upholsteryPixels: number;
    legPixels: number;
    upholsteryLegOverlap: number;
    upholsteryOutsideAlpha: number;
    legsOutsideAlpha: number;
    backgroundInUpholstery: number;
    ok: boolean;
    messages: string[];
  };
}

function countMaskOn(mask: { data: Uint8Array }, predicate: (v: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < mask.data.length; i++) if (predicate(mask.data[i])) n++;
  return n;
}

function isNearWhite(r: number, g: number, b: number): boolean {
  return r >= 248 && g >= 248 && b >= 248;
}

export async function runPrep(): Promise<PrepResult> {
  const source = await loadRgba(SOURCE_OUT);
  const { alpha, upholstery, legs } = await loadPhase1Masks(source);

  const paths = {
    sourceClean: finalPath('source-clean.png'),
    upholsteryMask: finalPath('upholstery-mask.png'),
    legMask: finalPath('leg-mask.png'),
    alphaMask: finalPath('alpha-mask.png'),
    prepDebugOverlay: finalPath('prep-debug-overlay.png'),
  };

  mkdirSync(dirname(paths.sourceClean), { recursive: true });
  await sharp(source.data, {
    raw: { width: source.width, height: source.height, channels: source.channels },
  })
    .png()
    .toFile(paths.sourceClean);

  await writeMaskPreview(paths.upholsteryMask, upholstery);
  await writeMaskPreview(paths.legMask, legs);
  await writeAlphaPreview(paths.alphaMask, source, alpha);
  await writeCombinedOverlay(paths.prepDebugOverlay, source, upholstery, legs);

  const messages: string[] = [];
  const upholsteryPixels = countMaskOn(upholstery, (v) => v >= 128);
  const legPixels = countMaskOn(legs, (v) => v >= 128);

  let upholsteryLegOverlap = 0;
  let upholsteryOutsideAlpha = 0;
  let legsOutsideAlpha = 0;
  let backgroundInUpholstery = 0;

  const { width, height, channels } = source;
  for (let j = 0; j < width * height; j++) {
    const up = upholstery.data[j] >= 128;
    const leg = legs.data[j] >= 128;
    const inAlpha = alpha.data[j] >= 128;
    if (up && leg) upholsteryLegOverlap++;
    if (up && !inAlpha) upholsteryOutsideAlpha++;
    if (leg && !inAlpha) legsOutsideAlpha++;
    if (up && inAlpha) {
      const p = j * channels;
      if (isNearWhite(source.data[p], source.data[p + 1], source.data[p + 2])) backgroundInUpholstery++;
    }
  }

  if (upholsteryPixels < 1000) messages.push('Upholstery mask too small');
  if (legPixels < 50) messages.push('Leg mask suspiciously small');
  if (upholsteryLegOverlap > 0) messages.push(`Upholstery∩legs overlap: ${upholsteryLegOverlap}px`);
  if (upholsteryOutsideAlpha > 0) messages.push(`Upholstery outside alpha: ${upholsteryOutsideAlpha}px`);
  if (legsOutsideAlpha > 0) messages.push(`Legs outside alpha: ${legsOutsideAlpha}px`);
  if (backgroundInUpholstery > upholsteryPixels * 0.02) {
    messages.push(`Background pixels in upholstery mask: ${backgroundInUpholstery}`);
  }

  const ok = messages.length === 0;

  return {
    source,
    alpha,
    upholstery,
    legs,
    paths,
    validation: {
      upholsteryPixels,
      legPixels,
      upholsteryLegOverlap,
      upholsteryOutsideAlpha,
      legsOutsideAlpha,
      backgroundInUpholstery,
      ok,
      messages,
    },
  };
}
