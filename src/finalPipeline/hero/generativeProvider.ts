import type { HeroGenerativeRequest, HeroGenerativeResult } from './spec.js';
import { OpenAIImageEditProvider } from './providers/openaiImageEdit.js';

export interface HeroGenerativeProvider {
  readonly id: string;
  isConfigured(): boolean;
  generate(request: HeroGenerativeRequest, outputPath: string): Promise<HeroGenerativeResult>;
}

export class HeroProviderNotConfiguredError extends Error {
  constructor(providerId: string, hint: string) {
    super(`Hero generative provider "${providerId}" is not configured. ${hint}`);
    this.name = 'HeroProviderNotConfiguredError';
  }
}

export class BundleOnlyProvider implements HeroGenerativeProvider {
  readonly id = 'bundle-only';

  isConfigured(): boolean {
    return false;
  }

  async generate(): Promise<HeroGenerativeResult> {
    throw new HeroProviderNotConfiguredError(
      this.id,
      'Set HERO_GENERATIVE_PROVIDER=openai and OPENAI_API_KEY (or HERO_GENERATIVE_API_KEY).',
    );
  }
}

const PROVIDER_IDS = ['bundle-only', 'openai'] as const;
export type HeroProviderId = (typeof PROVIDER_IDS)[number];

export function resolveHeroGenerativeProvider(): HeroGenerativeProvider {
  const raw = (process.env.HERO_GENERATIVE_PROVIDER || '').trim().toLowerCase();

  if (raw === 'bundle-only') return new BundleOnlyProvider();

  if (raw === 'openai' || !raw) {
    const openai = new OpenAIImageEditProvider();
    if (openai.isConfigured()) return openai;
    return new BundleOnlyProvider();
  }

  throw new Error(`Unknown HERO_GENERATIVE_PROVIDER="${raw}". Expected: ${PROVIDER_IDS.join(', ')}`);
}
