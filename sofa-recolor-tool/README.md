# Sofa Recolor Tool

Simple LAB batch recolor for ecommerce sofa renders.

## How it works

1. **Neutral-gray master** — built from `input/sofa.png` using the mask: upholstery pixels become gray at the **same luminance** (photographic detail kept).
2. **Manual mask** — `input/mask.png` is required (white = upholstery, black = background). No auto mask.
3. **Per swatch** — trim top/bottom 15% luminance, k-means (k=3), pick dominant saturated cluster centroid for **a/b**.
4. **Light leathers** (silk, eggshell, frost, etc.) — blend master L toward swatch L (`35%` / `65%`, clamped).

No depth restore, CLAHE, hero clustering, texture residuals, or dual pipelines.

## Inputs

| File | Required |
|------|----------|
| `input/sofa.png` | Yes |
| `input/mask.png` | Yes (manually cleaned) |
| `input/swatches/*.jpg` | Yes |

`input/master-sofa.png` is written when present (optional reference).

## Commands

```bash
npm install
npm run preview
npm run render
```

Outputs: `output/{Swatch-Name}.png`
