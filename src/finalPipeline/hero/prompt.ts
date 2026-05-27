import type { SwatchProfile } from '../spec.js';

export interface HeroPromptParts {
  system: string;
  user: string;
  negative: string;
}

/** Strict upholstery-only generative edit prompt (provider-agnostic text). */
export function buildHeroPrompt(profile: SwatchProfile): HeroPromptParts {
  const { code, textureClass, lightnessClass, targetLab } = profile;

  const system = [
    'You are retouching a product photo of a sofa for e-commerce.',
    'Edit ONLY the leather upholstery pixels indicated by the edit mask.',
    'Do not change sofa shape, seams placement, cushion structure, legs, feet, trim, or white background.',
    'Preserve photographic lighting geography from the base image (highlights and shadows in the same places).',
    'Output must look like a real product photograph, not airbrushed or CGI.',
  ].join(' ');

  const user = [
    `Recolor and re-material the upholstery to ${code} leather.`,
    `Material: ${textureClass} leather, ${lightnessClass} value range.`,
    `Target color direction approximately LAB L=${targetLab.l.toFixed(1)} a=${targetLab.a.toFixed(1)} b=${targetLab.b.toFixed(1)}.`,
    'Use the base recolor image for geometry, seams, and lighting.',
    'Use the clean swatch reference for subtle grain and organic mottle only — no folds, no patch tiling, no diagonal artifacts.',
    'Keep seams crisp but not outlined; no bottom-front dark line artifact; no chalky powdery finish.',
  ].join(' ');

  const negative = [
    'changed legs',
    'changed feet',
    'changed silhouette',
    'gray background',
    'dirty background',
    'swatch fold lines',
    'patch tiling',
    'repeated texture blocks',
    'airbrushed skin-like leather',
    'plastic CGI',
    'over-sharpened seams',
    'muddy brown color drift',
  ].join(', ');

  return { system, user, negative };
}

export function formatHeroPromptFile(parts: HeroPromptParts): string {
  return [
    '# Hero render prompt (upholstery-only generative edit)',
    '',
    '## System',
    parts.system,
    '',
    '## User',
    parts.user,
    '',
    '## Negative',
    parts.negative,
    '',
  ].join('\n');
}
