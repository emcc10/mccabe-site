# Sofa Recolor Tool

## How it works

1. **Overall swatch color** — average of every pixel on the full uploaded JPG (highlights, midtones, shadows included), not a center crop spot
2. **Sofa unchanged structure** — each pixel keeps its original **lightness** (folds, seams, highlights, shadows)
3. **Swatch color applied** — LAB Color mode: sofa L + overall swatch a/b

One swatch file → one overall color → one render.

## Commands

```bash
npm install
npm run preview
npm run render
```
