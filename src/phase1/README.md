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

Upholstery mask comes from `sofa-recolor-tool/input/mask.png`. Legs are auto-detected and subtracted with 4px protection.

Phase 2 (minimal recolor) is not implemented on this branch.
