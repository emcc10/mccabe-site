export interface HeroVariantSpec {
  id: 'A' | 'B';
  label: string;
  intent: string;
  /** Extra prompt guidance for this variant */
  promptAddon: string;
  /** Upholstery blend strength after generative pass (0–1) */
  upholsteryBlend: number;
  /** OpenAI input_fidelity when supported */
  inputFidelity: 'high' | 'low';
  model: 'gpt-image-1' | 'dall-e-2';
}

export const HERO_VARIANTS: HeroVariantSpec[] = [
  {
    id: 'A',
    label: 'HERO-A',
    intent: 'Safer / cleaner / softer photographed leather',
    promptAddon:
      'Keep the edit conservative: subtle natural grain, soft highlight rolloff, minimal texture change. Preserve all existing seams and cushion shapes exactly. Avoid heavy contrast or visible generative texture.',
    upholsteryBlend: 0.72,
    inputFidelity: 'high',
    model: 'gpt-image-1',
  },
  {
    id: 'B',
    label: 'HERO-B',
    intent: 'More realistic leather character, still refined',
    promptAddon:
      'Add believable photographed leather micro-grain and gentle organic mottling in open upholstery fields only. Keep refined luxury finish — not noisy, not plastic, not airbrushed.',
    upholsteryBlend: 0.88,
    inputFidelity: 'high',
    model: 'gpt-image-1',
  },
];
