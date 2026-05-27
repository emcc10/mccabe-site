import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { buildLower12Region } from '../phase6a/bottomSeam.js';
import { buildBottomGuard, buildOpenFieldMaterialWeight } from '../phase10/openFieldWeight.js';
import { clamp } from '../phase5/labUtil.js';
import { finalPath } from './paths.js';

export interface UpholsteryRegionMaps {
  openField: Float32Array;
  seamSuppress: Float32Array;
  highlightSuppress: Float32Array;
  bottomBandSuppress: Float32Array;
  /** Combined apply weight 0–1 for realism pass. */
  applyWeight: Float32Array;
}

export function buildUpholsteryRegionMaps(
  source: RgbaImage,
  upholstery: Mask,
  alpha: Mask,
  legs: Mask,
  highlightSoftness: number,
): UpholsteryRegionMaps {
  const { width, height } = source;
  const n = width * height;
  const gates = buildSourceStructureGates(source, upholstery);
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const openField = buildOpenFieldMaterialWeight(upholstery, gates, bottomGuard);

  const seamSuppress = gates.seamEdge;
  const highlightSuppress = gates.highlight;
  const bottomBandSuppress = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    if (lower12.data[j] >= 128) bottomBandSuppress[j] = 1;
  }

  const applyWeight = openField;

  return { openField, seamSuppress, highlightSuppress, bottomBandSuppress, applyWeight };
}

export async function writeRegionDebug(
  source: RgbaImage,
  upholstery: Mask,
  maps: UpholsteryRegionMaps,
): Promise<string> {
  const { width, height } = source;
  const buf = Buffer.alloc(width * height * 3);
  const { channels } = source;

  for (let j = 0; j < width * height; j++) {
    const o = j * 3;
    if (upholstery.data[j] < 128) {
      buf[o] = 240;
      buf[o + 1] = 240;
      buf[o + 2] = 245;
      continue;
    }
    const p = j * channels;
    const base = 0.35;
    const r = source.data[p] * base + maps.openField[j] * 180;
    const g = source.data[p + 1] * base + maps.applyWeight[j] * 200;
    const b = source.data[p + 2] * base + maps.seamSuppress[j] * 160;
    buf[o] = clamp(Math.round(r), 0, 255);
    buf[o + 1] = clamp(Math.round(g), 0, 255);
    buf[o + 2] = clamp(Math.round(b), 0, 255);
  }

  const out = finalPath('upholstery-region-debug.png');
  mkdirSync(dirname(out), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(out);
  return out;
}
