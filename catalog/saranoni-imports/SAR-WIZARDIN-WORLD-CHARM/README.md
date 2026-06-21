# SAR-WIZARDIN-WORLD-CHARM — missing size variants

Saranoni handle: `wizarding-world-charm-minky-lush`

## Volusion import steps

1. Set the product **base price** to the lowest variant price ($32.00 on Saranoni).
2. **Import** `Options_Import.csv` (Inventory → Import/Export → Options). Uses `applytoproductcodes` to link options to this product.
3. **Import** `Products_OptionIDs_Import.csv` (Products import).
4. Upload swatch/hero images from `variant_images.csv` to `/v/vspfiles/photos/` as `ThumbFile` / `SmallFile`.
5. Re-export Options to confirm IDs, then verify the PDP shows a **Choose Size** dropdown (category 58 — not color swatches).

Note: This is a **size-only** licensed blanket (one print). Variants are Mini / Receiving / Toddler / XL, matching [Saranoni wholesale](https://wholesale.saranoni.com/collections/harry-potter%E2%84%A2-collection/products/wizarding-world-charm-minky-lush).

## Variants

- **Mini** — option ID `1202`, pricediff `0`, Saranoni $32.00
- **Receiving** — option ID `1203`, pricediff `33`, Saranoni $65.00
- **Toddler** — option ID `1204`, pricediff `63`, Saranoni $95.00
- **XL** — option ID `1205`, pricediff `147`, Saranoni $179.00
