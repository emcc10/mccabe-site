# Sofa Recolor Tool

**RGB color balance** from uploaded leather swatches only.

## Source of truth

- **Only** `input/swatches/*.jpg` (e.g. `Evoque-Atlantic.jpg`, `Rein-Caramel.jpg`)
- Each render maps 1:1: `Evoque-Atlantic.jpg` → `output/Evoque-Atlantic.png`
- Color is extracted fresh on every run (center 40% crop, median RGB)
- No debug chips, flat color squares, cached palettes, or output files used as input

## Commands

```bash
npm install
npm run preview    # Bali-Currant
npm run render     # all swatches + rebuild manifest.json
npm run serve      # preview grid
```

## Pipeline

1. List leather files in `input/swatches/` (Collection-Name pattern)
2. Delete any `DEBUG-*` / chip / palette artifacts from `output/`
3. Median RGB from uploaded swatch image → color balance ratios → sofa PNG
