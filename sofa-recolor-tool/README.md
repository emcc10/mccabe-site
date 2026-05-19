# Sofa Recolor Tool

Simple LAB batch recolor for ecommerce sofa renders.

## How it works

1. **Neutral-gray master** — built from `input/sofa.png` using the mask: upholstery pixels become gray at the **same luminance** (photographic detail kept).
2. **Manual mask** — `input/mask.png` is required (white = upholstery, black = background). No auto mask.
3. **Per swatch** — median LAB **a/b** from the swatch image; **L** from the master is preserved.
4. **Light leathers** — optional mild L lift (~12% toward LAB L 82) when swatch RGB avg > 145.

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
