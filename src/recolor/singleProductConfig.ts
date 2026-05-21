import type { SingleProductConfig } from './types.js';

export const TEST_SOFA_CONFIG: SingleProductConfig = {
  productCode: 'TEST-SOFA',
  preserveLuminance: 0.84,
  shadowStrength: 0.92,
  detailStrength: 0.28,
  chromaVariationStrength: 0.22,
  highlightCompression: 0.18,
  textureBlend: 0.22,
  upholsteryExpandPx: 1,
  upholsteryContractPx: 1,
  legProtectionExpandPx: 3,
  smoothRadiusPx: 1,
  minRegionArea: 350,
};

const CONFIGS: Record<string, SingleProductConfig> = {
  'TEST-SOFA': TEST_SOFA_CONFIG,
};

export function getSingleProductConfig(productCode: string): SingleProductConfig {
  const cfg = CONFIGS[productCode];
  if (!cfg) throw new Error(`Unknown productCode: ${productCode}`);
  return { ...cfg };
}
