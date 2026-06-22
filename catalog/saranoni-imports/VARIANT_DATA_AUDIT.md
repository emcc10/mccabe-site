# Saranoni variant image data audit

JavaScript cannot fix incorrect Volusion import data. When multiple colors show the same thumbnail, the root cause is usually missing or duplicate CDN files, not the PDP renderer.

## Image naming convention (verified live)

For each Saranoni product `SAR-EXAMPLE` and color option ID `1234`:

| File | Purpose |
|------|---------|
| `SAR-EXAMPLE-1234-S.jpg` | Circular swatch thumbnail |
| `SAR-EXAMPLE-1234-T.jpg` | Main hero image when color is selected |

The PDP builds swatches from the native Volusion `<select>` option IDs and loads images using this convention via `buildDataDrivenSaranoniEntries()` in `mc-pdp-auth-cta-fix.js`.

## Audit scripts (run locally)

```bash
# Byte-identical duplicate T images on CDN (requires Volusion OptionIDs CSV in Downloads)
node scripts/audit_saranoni_duplicate_variant_images.cjs

# Missing/broken variant images vs CDN
node scripts/audit_saranoni_variant_images.cjs

# Live PDP behavior (price, swatches, layout)
node scripts/audit_saranoni_pdp_playwright.mjs
```

## Correction workflow

1. Run `audit_saranoni_duplicate_variant_images.cjs` → outputs `Saranoni_Duplicate_Variant_Images.csv`
2. Run `audit_saranoni_variant_images.cjs` → outputs upload list for missing files
3. Upload correct unique `-S.jpg` / `-T.jpg` per option in Volusion File Manager or import via `catalog/saranoni-imports/*/variant_images.csv`
4. Re-run Playwright audit to confirm unique swatch URLs on each PDP

## Per-product import folders

Product-specific Volusion CSVs live under `catalog/saranoni-imports/<PRODUCT_CODE>/`.

Do not hard-code color names or image URLs in shared template or JS.
