# SAR-HP-HP-ICONS-MNKY-LUSH — missing size variants

Saranoni handle: `harry-potter-icons-minky-lush`

## Volusion import steps

1. Set the product **base price** to the lowest variant price ($32.00 on Saranoni).
2. **Import** `Options_Import.csv` (Inventory → Import/Export → Options). Uses `applytoproductcodes` to link options to this product.
3. **Import** `Products_OptionIDs_Import.csv` (Products import).
4. Upload swatch/hero images from `variant_images.csv` to `/v/vspfiles/photos/` as `ThumbFile` / `SmallFile`.
5. Re-export Options to confirm IDs, then verify the PDP shows the selector.

Size options **1202–1205** are shared across licensed Minky/Lush blankets (SAR-WIZARDIN-WORLD-CHARM, SAR-HP-HP-ICONS-MNKY-LUSH). If you already imported sizes for another SKU, import **`Products_OptionIDs_Import.csv` only** and add this product code to each size option's `applytoproductcodes` in Volusion admin.

## Variants

- **Mini** — option ID `1202`, pricediff `0`, Saranoni $32.00
- **Receiving** — option ID `1203`, pricediff `33`, Saranoni $65.00
- **Toddler** — option ID `1204`, pricediff `63`, Saranoni $95.00
- **XL** — option ID `1205`, pricediff `147`, Saranoni $179.00
