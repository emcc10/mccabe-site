# SAR-COTTON-MSLN-4-LAYER — missing color variants

Saranoni handle: `cotton-muslin-4-layer-quilt`

## Volusion import steps

1. Set the product **base price** to **$65.00** (Simple Buds / Pine on Saranoni). If you use $52 as base instead, the pricediffs in `Options_Import.csv` are correct as-is.
2. **Import** `Options_Import.csv` (Inventory → Import/Export → Options). Uses `applytoproductcodes` to link options to this product.
3. **Import** `Products_OptionIDs_Import.csv` (Products import).
4. Upload swatch/hero images from `variant_images.csv` to `/v/vspfiles/photos/` as `ThumbFile` / `SmallFile`.
5. Re-export Options to confirm IDs, then verify the PDP shows the selector.

## Variants

- **Simple Buds** — option ID `1159`, pricediff `0`, Saranoni $65.00
- **Pine** — option ID `1160`, pricediff `0`, Saranoni $65.00
- **Olive Branch** — option ID `1161`, pricediff `-13`, Saranoni $52.00
- **Floral Fields** — option ID `1162`, pricediff `-13`, Saranoni $52.00
