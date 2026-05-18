# Sofa Recolor Tool

**Luminance gradient-map** recolor: sofa folds/highlights/shadows drive mapping; swatch controls hue, saturation, and brightness curve.

## Commands

```bash
cd sofa-recolor-tool
npm install
npm run preview
npm run render
```

## Pipeline

1. **Leather mask** — upholstery only (no bg, legs, floor bleed)
2. **Sofa L range** — p2–p98 LAB L on masked leather
3. **Swatch curve** — center crop, per-L median a/b LUT + L_dark / L_core / L_bright (p5/p50/p95)
4. **Gradient map** — normalize sofa L → map to swatch L curve → sample swatch chroma at that L
5. **Highlights** — reduce a/b above L≈76 (speculars stay soft, not neon)
6. **Black leathers** — median L &lt; 18: deepest folds pushed toward true black

Uses [color-convert](https://www.npmjs.com/package/color-convert) for RGB↔LAB only.
