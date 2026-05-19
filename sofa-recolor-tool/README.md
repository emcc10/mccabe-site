# Sofa Recolor Tool

**LAB chroma recolor** — hero a/b + ab texture residual. Dark swatches keep sofa L. Light leathers: swatch L blend, neutral a/b clamp, then material-depth pass (grain detail, specular/crease restore, masked CLAHE) without global brightness lift.

## Commands

```bash
npm install
npm run preview
npm run render
```

Source: `input/swatches/*.jpg` only.
