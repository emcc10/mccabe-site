# Sofa Recolor Tool

**HSL color-blend** recolor — original lightness and shading preserved; swatch controls hue and saturation.

## Commands

```bash
cd sofa-recolor-tool
npm install
npm run preview
npm run render
```

## Per upholstery pixel

```
base = original HSL
target = swatch HSL (median from center crop)

finalL = base.l                    // 100% original luminance
finalH = target.h
finalS = base.s * 0.55 + target.s * 0.45

if base.l < 0.16:                 // deep seams/shadows
  finalH = blend(base.h, target.h, 0.5)
  finalS = base.s * 0.8 + target.s * 0.2
```

Convert back to RGB. Binary mask only — no opacity overlays, no luminance multiply, no flat RGB replace.
