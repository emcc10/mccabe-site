import { existsSync } from 'fs';
import { LEGACY_UPHOLSTERY_MASK, LEG_MASK_OVERRIDE } from './paths.js';
import { buildPhase1Masks, loadMaskPng, type RgbaImage } from './segment.js';

export async function loadPhase1Masks(image: RgbaImage) {
  const handUpholstery = await loadMaskPng(LEGACY_UPHOLSTERY_MASK, image.width, image.height);
  const handLegs = existsSync(LEG_MASK_OVERRIDE)
    ? await loadMaskPng(LEG_MASK_OVERRIDE, image.width, image.height)
    : undefined;
  return buildPhase1Masks(image, handUpholstery, handLegs);
}
