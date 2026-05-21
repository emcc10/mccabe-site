# Sofa Recolor Tool

Simple LAB batch recolor for ecommerce sofa renders.

## How it works

1. **Neutral-gray master** — built from `input/sofa.png` using the mask: upholstery pixels become gray at the **same luminance** (photographic detail kept).
2. **Manual mask** — `input/mask.png` is required (white = upholstery, black = background). No auto mask.
3. **Per swatch** — trim top/bottom 15% luminance, k-means (k=3), pick dominant saturated cluster centroid for **a/b**.
4. **Luminance** — per pixel: `masterL × 0.82 + swatchL × 0.18` (light leathers: `0.72` / `0.28`). No flattening or global remap.

No depth restore, CLAHE, hero clustering, texture residuals, or dual pipelines.

## Inputs

| File | Required |
|------|----------|
| `input/sofa.png` | Yes |
| `input/mask.png` | Yes (manually cleaned) |
| `input/swatches/*.jpg` | Yes |

`input/master-sofa.png` is written when present (optional reference).

## Bali-Silk (production)

1. Recolor from `input/sofa.png` + mask (Bali chroma, preserved tone).
2. **Reference realism transfer** — injects photographic L-detail from a donor render (not a full-image blend).
3. Finalize pass — pure white background, contact shadow, bottom-band cleanup.

| File | Role |
|------|------|
| `input/Bali-Silk-realism-reference.png` | Photorealistic donor (pin with `npm run bali-ref-setup` after `bali-stress`, or place your own 800×600 PNG) |

```bash
npm run bali-stress      # generate donor candidate
npm run bali-ref-setup   # copy latest stress → input reference
npm run bali             # production Bali-Silk-*.png
```

## Commands

```bash
npm install
npm run preview
npm run render
```

Outputs: `output/{Swatch-Name}.png`
