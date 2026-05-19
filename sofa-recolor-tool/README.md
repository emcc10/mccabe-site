# Sofa Recolor Tool

Dual pipeline batch recolor from `input/sofa.png` and `input/swatches/*.jpg`.

## Pipelines

**A — Dark / medium leather** (cognac base)  
Hero chroma + high-frequency a/b texture; **preserves** original sofa luminance and depth restore.

**B — Light leather** (Silk, Eggshell, Frost, Tusk, Vanilla, Mist, etc.)  
Per swatch: `finalBaseL = cognacL × 0.55 + lightTargetL × 0.45` (+ detail × 0.65). Targets: cream 190, off-white 200, gray/taupe 175. Then hero a/b + ±2 texture residual. No flat remap / CLAHE.

**Mask** (both pipelines): close holes, dilate 2px, include cognac edge pixels, ~0.5px feather.

## Commands

```bash
npm install
npm run preview
npm run render
```

Source: `input/swatches/*.jpg` only.
