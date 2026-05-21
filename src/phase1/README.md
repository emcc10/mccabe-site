# Phase 1 — TEST-SOFA segmentation only

Single sofa. No recolor, no swatch cache, no realism/maps.

## Run

```bash
npm run phase1:test-sofa
```

## Outputs

| File | Path |
|------|------|
| source | `public/product-assets/TEST-SOFA/source.png` |
| alpha preview | `public/product-assets/TEST-SOFA/debug/alpha-preview.png` |
| upholstery mask | `public/product-assets/TEST-SOFA/debug/upholstery-mask-preview.png` |
| leg mask | `public/product-assets/TEST-SOFA/debug/leg-mask-preview.png` |
| combined overlay | `public/product-assets/TEST-SOFA/debug/combined-overlay-preview.png` |

Upholstery mask comes from `sofa-recolor-tool/input/mask.png`.

Legs use **`leg-mask.override.png`** when present (your hand-edited leg mask). Otherwise auto-detected.

## Stage 2 proof

```bash
npm run prove:stage2
```

## Stage 3 swatch match (explicit only)

```bash
npm run render:stage3
```

Outputs in `debug/`:
- `phase2-bali-silk.png`, `phase2-comparison.png`, `stage2-spec.json`, `stage2-structural-metrics.json`
- `phase3-bali-silk.png`, `phase3-comparison.png`, `stage3-spec.json`, `stage3-metrics.json`
