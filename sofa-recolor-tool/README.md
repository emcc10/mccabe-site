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

1. `input/sofa.png` → **swatch chroma only** (LAB a/b from Bali-Silk; source ΔL preserved).
2. **Measured HF/MF Rec.709 residuals** from `sofa.png` applied **after** chroma + luma lock (interior mask only, >6px from edge).
3. **LF specular sheen attenuation** — smooth highlight rolloff only (cushion interiors, upper luma); HF/MF and global brightness unchanged.
4. **Export gate** — writes PNG only if upholstery RMS Δ vs previous production render ≥ 3.0.
5. **Finalize only** — white background, contact shadow, bottom-band cleanup (upholstery untouched).

No synthesis, reference transfer, sharpening, or upholstery post-processing.

```bash
npm run bali             # production Bali-Silk-*.png
npm run bali-probe       # TEMP: pipeline debug + exaggerated source-detail test
```

## Commands

```bash
npm install
npm run preview
npm run render
```

Outputs: `output/{Swatch-Name}.png`
