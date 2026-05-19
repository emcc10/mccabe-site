# Sofa Recolor Tool

**LAB chroma-only recolor** — each swatch is sampled in **shadow / midtone / highlight** zones; sofa pixels receive the matching zone’s a/b based on original luminance. A **luminance-only** depth pass restores photo contrast and texture. No overlay or brightness transfer.

## Commands

```bash
npm install
npm run preview
npm run render
```

Source: `input/swatches/*.jpg` only.
