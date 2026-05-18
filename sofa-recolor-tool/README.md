# Sofa Recolor Tool

**Direct opaque luminance recolor** — no overlays, opacity, or RGB blending.

## Commands

```bash
cd sofa-recolor-tool
npm install
npm run preview
npm run render
```

## Pipeline

1. **Leather mask** — upholstery, seams, bottom front rail; excludes legs, background, floor shadow only below sofa base
2. **Swatch target** — center crop, median RGB
3. **Per masked pixel** (fully opaque):

```
lum = 0.2126*r + 0.7152*g + 0.0722*b
shade = clamp(lum / 165, 0.45, 1.22)
finalR = targetR * shade
finalG = targetG * shade
finalB = targetB * shade
alpha = original alpha
```

No LAB, no `mask/255` blend, no semi-transparent layers.
