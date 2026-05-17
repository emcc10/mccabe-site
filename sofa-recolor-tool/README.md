# Sofa Recolor Tool

Deterministic batch recolor: one base sofa + many leather swatch photos → one PNG per swatch + ZIP.

No AI. No resize. Same pixel dimensions as `input/sofa.png` every time.

## Setup

```bash
cd sofa-recolor-tool
npm install
```

## Input layout

```
input/
  sofa.png              ← required: white-background product shot
  mask.png              ← optional: white = recolor, black = keep
  swatches/
    Rein-Eggshell.jpg
    Bali-Silk.jpg
    ...
```

## Run

**One swatch (fast — default Bali Currant):**

```bash
npm run preview
```

**All swatches + ZIP:**

```bash
npm run render
```

Single swatch by name:

```bash
node render-sofas.js Rein-Eggshell.jpg
```

## Output

```
output/
  Rein-Eggshell.png
  Bali-Silk.png
  ...
  sofa-renders.zip
```

Output filenames match swatch filenames (extension changed to `.png`).

## How color is computed

1. Center **50%** crop of each swatch (avoids fold edges).
2. **Median** RGB on that crop.
3. **Average** RGB on that crop.
4. `targetColor = median × 0.75 + average × 0.25`
5. Sofa pixels keep **original luminance** (folds, shadows, highlights). Only Lab **a/b** shift from cognac on the photo → swatch color.

## Mask

Auto mask: pixels where `r,g,b > 235` are background. Everything else is upholstery (feathered ~1.2px).

Pixels with brightness `< 35` (feet) are left unchanged.

Optional `input/mask.png` must be the same size as `sofa.png`.
