import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import { loadRgba } from '../phase1/segment.js';
import {
  artifactMaskPreview,
  buildCleanSwatchMaterial,
  colorBiasPreview,
  fieldToGrayPreview,
} from '../phase9reset/swatchSanitize.js';
import type { CleanSwatchMaterial } from '../phase9reset/swatchSanitize.js';
import type { SwatchProfile } from './spec.js';
import { cleanSwatchPath } from './paths.js';
import { getSwatchImagePath } from './swatchProfiles.js';

export interface SwatchCleanResult {
  material: CleanSwatchMaterial;
  paths: {
    cleanBase: string;
    cleanGrain: string;
    cleanMottle: string;
    cleanColorBias: string;
    cleanArtifactMask: string;
  };
}

async function writeRgb(path: string, width: number, height: number, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(path);
}

export async function runSwatchClean(profile: SwatchProfile): Promise<SwatchCleanResult> {
  const swatchPath = getSwatchImagePath(profile.code);
  const swatch = await loadRgba(swatchPath);
  const material = buildCleanSwatchMaterial(swatch);
  const { width, height } = material;

  const paths = {
    cleanBase: cleanSwatchPath('base', profile.code),
    cleanGrain: cleanSwatchPath('grain', profile.code),
    cleanMottle: cleanSwatchPath('mottle', profile.code),
    cleanColorBias: cleanSwatchPath('color-bias', profile.code),
    cleanArtifactMask: cleanSwatchPath('artifact-mask', profile.code),
  };

  await writeRgb(paths.cleanBase, width, height, material.cleanBaseRgb);
  await writeRgb(paths.cleanGrain, width, height, fieldToGrayPreview(material.grain, width, height));
  await writeRgb(paths.cleanMottle, width, height, fieldToGrayPreview(material.mottle, width, height));
  await writeRgb(
    paths.cleanColorBias,
    width,
    height,
    colorBiasPreview(material.colorBiasA, material.colorBiasB, width, height),
  );
  await writeRgb(
    paths.cleanArtifactMask,
    width,
    height,
    artifactMaskPreview(material.artifactMask, width, height),
  );

  return { material, paths };
}
