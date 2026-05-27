import type { HeroGenerativeRequest, HeroGenerativeResult } from './spec.js';

export interface HeroGenerativeProvider {
  readonly id: string;
  isConfigured(): boolean;
  /**
   * Run upholstery-only generative edit.
   * Implementations must respect edit mask + protected mask from the input bundle.
   */
  generate(request: HeroGenerativeRequest, outputPath: string): Promise<HeroGenerativeResult>;
}

export class HeroProviderNotConfiguredError extends Error {
  constructor(providerId: string, hint: string) {
    super(`Hero generative provider "${providerId}" is not configured. ${hint}`);
    this.name = 'HeroProviderNotConfiguredError';
  }
}

/** Default: prepare inputs only; no external API call. */
export class BundleOnlyProvider implements HeroGenerativeProvider {
  readonly id = 'bundle-only';

  isConfigured(): boolean {
    return false;
  }

  async generate(): Promise<HeroGenerativeResult> {
    throw new HeroProviderNotConfiguredError(
      this.id,
      'Set HERO_GENERATIVE_PROVIDER to a real provider when ready. Input bundle was written.',
    );
  }
}

/**
 * Placeholder for a future OpenAI / Fal / Replicate upholstery edit integration.
 * Wire credentials via env and implement `generate()` when ready.
 */
export class StubConfiguredProvider implements HeroGenerativeProvider {
  readonly id;

  constructor(id: string) {
    this.id = id;
  }

  isConfigured(): boolean {
    return Boolean(process.env.HERO_GENERATIVE_API_KEY?.trim());
  }

  async generate(_request: HeroGenerativeRequest, _outputPath: string): Promise<HeroGenerativeResult> {
    throw new Error(
      `Provider "${this.id}" is registered but not implemented yet. ` +
        'Implement hero/generativeProvider.ts or use bundle-only mode.',
    );
  }
}

const PROVIDER_IDS = ['bundle-only', 'openai', 'fal', 'replicate'] as const;
export type HeroProviderId = (typeof PROVIDER_IDS)[number];

export function resolveHeroGenerativeProvider(): HeroGenerativeProvider {
  const raw = (process.env.HERO_GENERATIVE_PROVIDER || 'bundle-only').trim().toLowerCase();
  if (raw === 'bundle-only' || !raw) return new BundleOnlyProvider();
  if (raw === 'openai' || raw === 'fal' || raw === 'replicate') {
    return new StubConfiguredProvider(raw);
  }
  throw new Error(
    `Unknown HERO_GENERATIVE_PROVIDER="${raw}". Expected: ${PROVIDER_IDS.join(', ')}`,
  );
}
