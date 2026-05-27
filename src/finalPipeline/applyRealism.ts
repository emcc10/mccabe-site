import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { applyCleanSwatchMaterial } from '../phase9reset/apply.js';
import type { CleanSwatchMaterial } from '../phase9reset/swatchSanitize.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { buildOpenFieldMaterialWeight } from '../phase10/openFieldWeight.js';
import type { RealismApplyParams, RealismVariantSpec, SwatchProfile } from './spec.js';
import { finalVariantPath } from './paths.js';

/** Phase-10-calibrated absolute strengths (profile scales fine-tune per swatch). */
const ABS_REALISM = {
  A: { grain: 0.82, mottle: 0.52, colorBias: 0.2 },
  B: { grain: 1.05, mottle: 0.72, colorBias: 0.24 },
  C: { grain: 1.32, mottle: 0.92, colorBias: 0.28 },
} as const;

const PROFILE_REF_GRAIN = 0.58;

export function buildRealismApplyParams(
  profile: SwatchProfile,
  variant: RealismVariantSpec,
): RealismApplyParams {
  const abs = ABS_REALISM[variant.id];
  const profileScale = profile.grainStrength / PROFILE_REF_GRAIN;
  const gain = variant.visibilityGain;
  return {
    grainStrength: abs.grain * profileScale * variant.grainMul * gain,
    mottleStrength:
      abs.mottle * (profile.mottleStrength / 0.38) * variant.mottleMul * gain,
    colorBiasStrength:
      abs.colorBias * (profile.colorBiasStrength / 0.15) * variant.colorBiasMul * gain,
    formStrength: variant.formStrength,
    sampleScale: variant.sampleScale,
    visibilityGain: variant.visibilityGain,
  };
}

export async function applyRealismVariant(
  profile: SwatchProfile,
  variant: RealismVariantSpec,
  base: RgbaImage,
  source: RgbaImage,
  upholstery: Mask,
  material: CleanSwatchMaterial,
  materialWeight: Float32Array,
): Promise<{ image: RgbaImage; path: string; params: RealismApplyParams }> {
  const params = buildRealismApplyParams(profile, variant);
  const gates = buildSourceStructureGates(source, upholstery);
  const image = applyCleanSwatchMaterial(
    base,
    upholstery,
    material,
    gates,
    materialWeight,
    params,
  );
  const path = finalVariantPath(variant.id, profile.code);
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
  return { image, path, params };
}
