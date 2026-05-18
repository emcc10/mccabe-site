# Sofa Recolor Tool

Safe **LAB A/B transfer** via [color-convert](https://www.npmjs.com/package/color-convert) (no custom color math). Original **L (luminance) is never modified**.

## Commands

```bash
cd sofa-recolor-tool
npm install
npm run preview
npm run render
```

## Pipeline (`lab-ab-transfer`)

1. Upholstery mask → dilate 1px (no feather)
2. Per masked pixel (float RGB 0–1):
   - `RGB → LAB` (color-convert: L 0–100, signed a/b)
   - `finalL = baseL` (unchanged)
   - `finalA/B = lerp(base, target, mix)` — mix reduced in deep shadows
   - `LAB → RGB` → clip 0–1 → uint8
3. Swatch target: center 35% crop, blur 12px, **median RGB** → LAB

No HSL recolor, no multiply/overlay, no homemade LAB.
