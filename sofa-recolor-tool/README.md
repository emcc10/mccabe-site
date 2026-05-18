# Sofa Recolor Tool

**LAB color mode** (like Photoshop Color): keeps sofa lighting (L), applies true swatch color (a/b).

## Source of truth

Only `input/swatches/*.jpg` — one file → one median core tone → one render.

## Why not RGB channel balance?

Scaling brown sofa RGB cannot produce navy, gray, or cream — ratios leave warm undertones. LAB separates lightness from color correctly.

## Commands

```bash
npm install
npm run preview
npm run render
```
