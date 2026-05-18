# Sofa Manual Recolor Tool

Automated batch recolor was removed. Use the browser tool to paint a mask and tune HSL sliders per leather color.

## Quick start

```bash
cd sofa-recolor-tool
npm install
npm run manual
```

Open **http://127.0.0.1:3457/manual-recolor.html**

## Workflow

1. Load **input/sofa.png** (auto-loaded when served) or upload your base sofa.
2. **Paint** the upholstery mask (arms, cushions, front rail). Erase legs, floor, background.
3. Upload a swatch for reference; set **preset name** (e.g. `Bali-Currant`).
4. Adjust sliders until the preview looks right.
5. **Save settings for name** — stores sliders in the browser.
6. **Save preview PNG** — one full-size PNG, no resize.
7. Repeat for each leather, then **Batch export all presets** to download every saved name.

## Presets

- Saved in browser `localStorage`.
- **Export presets JSON** to back up or move to another machine.
- **Import presets JSON** before batch export on a new session.

## Mask

- **Download mask PNG** / **Load mask PNG** — reuse the same mask across colors.
- Mask is also cached in `localStorage` for the same browser session.

## Files

| Path | Purpose |
|------|---------|
| `manual-recolor.html` | Main tool |
| `input/sofa.png` | Base cognac sofa |
| `input/swatches/*.jpg` | Leather swatches (reference only) |
| `output/` | Your exported PNGs (local) |
