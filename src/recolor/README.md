# Single-product leather recolor (TEST-SOFA)

One-sofa pipeline: auto segmentation, cached masks/maps, deterministic swatch renders.

## Commands

```bash
npm install
npm run build:assets -- TEST-SOFA
npm run approve:product -- TEST-SOFA
npm run render:swatches -- TEST-SOFA BALI-SILK
npm run render:swatches -- TEST-SOFA --all
```

Bootstrap uses `sofa-recolor-tool/input/sofa.png` and copies `input/mask.png` to `upholstery-mask.override.png` when present.

## Override masks (optional)

If these exist under `public/product-assets/TEST-SOFA/`, they replace auto segmentation:

- `upholstery-mask.override.png`
- `leg-mask.override.png`
- `trim-mask.override.png`

## Render flow

1. `loadSingleProductAssets` / `ensureProductAssets`
2. If missing or `forceRebuild`: `buildSegmentationForProduct` → `saveDerivedMaps`
3. `getSwatchProfile` + `getSingleProductConfig`
4. `recolorUpholstery` (upholstery mask only)
5. `compositeFinalRender` (original alpha + leg/trim restore)
6. `enforceLegExclusion` + stray band cleanup
7. `runRenderQA`
8. Cache PNG **only** under `public/render-cache/TEST-SOFA/{SWATCH}-{cacheKey}.png`

**Never** store swatch renders in `product-assets/` — only `source.png` + masks/maps live there.

Contour truth: `alpha.png` from source — never from recolored pixels.
