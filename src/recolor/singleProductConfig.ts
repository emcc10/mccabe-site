import type { SingleProductConfig } from './types.js';

export const TEST_SOFA_CONFIG: SingleProductConfig = {
  productCode: 'TEST-SOFA',
  recolorMode: 'debug-flat-safe',
  preserveLuminance: 0.93,
  shadowStrength: 1.0,
  detailStrength: 0.4,
  chromaVariationStrength: 0.1,
  highlightCompression: 0.08,
  textureBlend: 0.1,
  upholsteryExpandPx: 0,
  upholsteryContractPx: 1,
  legProtectionExpandPx: 4,
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
