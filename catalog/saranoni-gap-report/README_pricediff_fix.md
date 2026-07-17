# Saranoni variant pricediff + wearable image fix

## Root cause

Option import generators treated Shopify **cent** price differences as Volusion **dollar** `pricediff` values.

Examples on live:

| Product | Option | Live (wrong) | Correct |
|---------|--------|--------------|---------|
| SAR-WEARABLE | Medium Minky / Medium Faux Fur | +$187 | +$3 |
| SAR-COZY-BMB-ROBES | Tori Halford | +$1000 | +$10 |
| SAR-SNUGGLER / SAR-JL-JL-SNUGGLER | Teen / Adult | +$1000 / +$2000 | +$10 / +$20 |
| SAR-STRETCHY-SWADDLES-HATS | Swaddle | +$1613 | +$14 |

Wearable also had **no color swatches/images** because color OptionIDs were not attached on the product row (only size IDs 1411–1414).

## Import order (Volusion)

1. **Options pricediff fix (all affected)**  
   `saranoni_pricediff_cents_bug_fix_options_import.csv`  
   (or wearable-only: `saranoni_wearable_pricediff_fix_options_import.csv`)

2. **Wearable product OptionIDs** (attach colors + sizes)  
   `saranoni_wearable_products_optionids_import.csv`  
   Excel-safe copy: `saranoni_wearable_products_optionids_import_excel_safe.tsv`

3. **Upload wearable color images** from `vspfiles/photos/`:
   - `SAR-WEARABLE-1049-T.jpg` / `-S.jpg` (Feather)
   - `SAR-WEARABLE-1154-T.jpg` / `-S.jpg` (Cream)
   - `SAR-WEARABLE-1155-T.jpg` / `-S.jpg` (Hazel)

Image manifest: `saranoni_wearable_variant_images.csv`

## Wearable expected pricing after fix

- Product base: **$59.00** (Saranoni retail / compare-at)
- Small Minky / Small Faux Fur: +$0 → $59
- Medium Minky / Medium Faux Fur: +$3 → $62
- Colors Feather / Cream / Hazel: +$0 (Hazel may be sold out on Saranoni)

## Notes

- HP Icons size upcharges (+$33 / +$63 / +$147) are **correct** dollar amounts — leave them.
- Option `1352` Snow Fox on `SAR-GRAND-FX-FUR` should be removed from that product’s OptionIDs after zeroing pricediff (not a current throw color).
- Generators patched so this cannot recur: `scripts/generate_saranoni_variant_imports.py`, `scripts/build_saranoni_volusion_options.py`.
