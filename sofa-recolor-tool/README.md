# Sofa Recolor Tool

Dual pipeline batch recolor from `input/sofa.png` and `input/swatches/*.jpg`.

## Pipelines

**A — Dark / medium leather** (cognac base)  
Hero chroma + high-frequency a/b texture; **preserves** original sofa luminance and depth restore.

**B — Light leather** (Silk, Eggshell, Frost, Tusk, Vanilla, Mist, etc.)  
Builds a **lifted neutral gray sofa** from the cognac photo (desaturated, raised shadows/mids/highlights, seams kept). Swatch color is applied on that base — **does not** preserve cognac darkness.

Light-base targets (RGB): panel mids ~185–210, shadow floor ~115–130, highlights ~220–235.

## Commands

```bash
npm install
npm run preview
npm run render
```

Source: `input/swatches/*.jpg` only.
