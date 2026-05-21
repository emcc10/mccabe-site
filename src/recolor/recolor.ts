import convert from 'color-convert';
import type { ImageRGBA, MaskData, SingleProductConfig, SwatchProfile } from './types.js';
import type { ProductRenderAssets } from './types.js';
import { join } from 'path';
import { productDir } from './paths.js';
import { loadDerivedMaps } from './maps.js';
import { loadImageRGBA } from './imageIO.js';

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function rgbToLab(r: number, g: number, b: number) {
  const [L, a, bVal] = convert.rgb.lab([r, g, b]);
  return { L, a, b: bVal };
}

function labToRgb(L: number, a: number, b: number) {
  const [r, g, bOut] = convert.lab.rgb([
    clamp(L, 0, 100),
    clamp(a, -128, 128),
    clamp(b, -128, 128),
  ]);
  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(bOut, 0, 255)),
  };
}

export async function recolorUpholstery(
  baseImage: ImageRGBA,
  assets: ProductRenderAssets,
  upholsteryMask: MaskData,
  swatch: SwatchProfile,
  config: SingleProductConfig,
): Promise<ImageRGBA> {
  const dir = productDir(assets.productCode);
  const maps = await loadDerivedMaps(
    {
      shadowPath: join(dir, 'shadow-map.png'),
      detailPath: join(dir, 'detail-map.png'),
      highlightPath: join(dir, 'highlight-map.png'),
    },
    upholsteryMask,
  );

  const out = Buffer.from(baseImage.data);
  const { width, height, channels } = baseImage;
  const preserve = config.preserveLuminance;
  const shadowStr = config.shadowStrength;
  const detailStr = config.detailStrength;
  const chromaStr = config.chromaVariationStrength * swatch.chromaVariation;
  const hiComp = config.highlightCompression * swatch.highlightSoftness;
  const texBlend = config.textureBlend * swatch.grainStrength;

  for (let j = 0; j < width * height; j++) {
    if (upholsteryMask.data[j] < 128) continue;
    const p = j * channels;
    const src = rgbToLab(baseImage.data[p], baseImage.data[p + 1], baseImage.data[p + 2]);

    const shadowLift = (maps.shadow[j] - 0.5) * 8 * shadowStr;
    let L =
      src.L * preserve +
      swatch.lab.l * (1 - preserve) +
      shadowLift +
      (maps.detail[j] - 0.5) * 14 * detailStr;

    const chromaDrift = (maps.detail[j] - 0.5) * 2.2 * chromaStr;
    let a = src.a * (1 - texBlend) + swatch.lab.a * texBlend + chromaDrift;
    let b = src.b * (1 - texBlend) + swatch.lab.b * texBlend + chromaDrift * 0.85;

    const hi = maps.highlight[j];
    if (hi > 0.2) {
      const cut = hi * hiComp * 6;
      L = Math.max(0, L - cut);
    }

    const rgb = labToRgb(L, a, b);
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = baseImage.data[p + 3];
  }

  return { data: out, width, height, channels };
}
