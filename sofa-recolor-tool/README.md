# Sofa Recolor Tool

Soft **HSL transfer** on a base sofa photo: original lighting and luminance preserved; only hue and saturation shift toward each swatch.

## Commands

```bash
cd sofa-recolor-tool
npm install
npm run preview          # Bali-Currant → output/Bali-Currant.png
npm run render           # all swatches + sofa-renders.zip
npm run serve            # click swatches in browser (after render)
```

## Method (`soft-hsl-transfer`)

1. Upholstery mask (leather + seams; no legs / bg / floor shadow) → dilate 1px → feather ~0.8px  
2. Per pixel: `finalH = swatchH`, `finalS = baseS×0.35 + swatchS×0.75`, `finalL = baseL` (+ shadow/highlight tweaks)  
3. Light softness pass on recolored upholstery only  

Optional: place `input/mask.png` (same size as sofa) to refine silhouette.

## Layout

| Path | Role |
|------|------|
| `input/sofa.png` | Base cognac sofa |
| `input/swatches/*.jpg` | Leather swatches |
| `output/*.png` | Rendered sofas (gitignored) |
