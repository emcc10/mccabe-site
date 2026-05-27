import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import { loadRgba } from '../phase1/segment.js';
import {
  artifactMaskPreview,
  buildCleanSwatchMaterial,
  colorBiasPreview,
  fieldToGrayPreview,
} from '../phase9reset/swatchSanitize.js';
import type { SwatchCleanValidation } from '../phase9reset/swatchSanitize.js';
import type { CleanSwatchMaterial } from '../phase9reset/swatchSanitize.js';
import type { SwatchProfile } from './spec.js';
import { cleanSwatchPath, finalPath } from './paths.js';
import { getSwatchImagePath } from './swatchProfiles.js';

export interface SwatchCleanResult {
  material: CleanSwatchMaterial;
  validation: SwatchCleanValidation;
  paths: {
    cleanBase: string;
    cleanGrain: string;
    cleanMottle: string;
    cleanColorBias: string;
    cleanArtifactMask: string;
    validationJson: string;
  };
}

async function writeRgb(path: string, width: number, height: number, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(path);
}

/**
 * Sanitize swatch, export helper maps, and reject if diagonal/fold artifact remains visible.
 */
export async function runSwatchClean(profile: SwatchProfile): Promise<SwatchCleanResult> {
  const swatchPath = getSwatchImagePath(profile.code);
  const swatch = await loadRgba(swatchPath);
  const material = buildCleanSwatchMaterial(swatch);
  const { width, height } = material;
  const validation = material.validation;

  const slug = profile.code.toUpperCase().replace(/\s+/g, '-');
  const paths = {
    cleanBase: cleanSwatchPath('base', profile.code),
    cleanGrain: cleanSwatchPath('grain', profile.code),
    cleanMottle: cleanSwatchPath('mottle', profile.code),
    cleanColorBias: cleanSwatchPath('color-bias', profile.code),
    cleanArtifactMask: cleanSwatchPath('artifact-mask', profile.code),
    validationJson: finalPath(`clean-swatch-validation-${slug}.json`),
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

  writeFileSync(
    paths.validationJson,
    JSON.stringify(
      {
        swatchCode: profile.code,
        ok: validation.ok,
        validation,
        note: 'buildCleanSwatchMaterial already asserted ok before export',
      },
      null,
      2,
    ),
  );

  console.log(
    `[swatch-clean] ${profile.code} diagonalScore=${validation.diagonalBandScore.toFixed(2)} maxDiag=${validation.maxDiagonalResidual.toFixed(2)} ok=${validation.ok}`,
  );

  return { material, validation, paths };
}
