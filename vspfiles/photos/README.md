# PLP product photos

Volusion expects files here as `{ProductCode}-1.jpg` (e.g. `77743-01-1.jpg`).

Refresh missing Palliser stock shots with:

```bash
py -3 scripts/fetch_missing_palliser_stock_photos.py --force
```

Sources are Palliser dealer/catalog studio photography — **not** spec-sheet PDFs (those contain QR codes, not product photos).

Pushes that change images under `vspfiles/photos/` trigger **Deploy PLP photos to Volusion** (GitHub Actions).
