# Sofa Recolor Tool

**RGB color balance** — scales original sofa channels; one median target per swatch.

## Pipeline

1. **One target RGB** — center 40% of swatch, light blur (textured reference), median of mid-tones only
2. **Sofa average RGB** — mean of masked upholstery (fixed per batch)
3. **Ratios** — `target / sofaAvg`, clamped `0.45`–`2.2`
4. **Per pixel** — `new = original * ratio`; `final = original * 0.35 + new * 0.65`

No HSL, LAB, hue rotate, opacity overlays, or flat RGB replace.

`DEBUG-*-crop.png` files are diagnostic previews only — never used for export.

## Commands

```bash
npm install
npm run preview
npm run render
```
