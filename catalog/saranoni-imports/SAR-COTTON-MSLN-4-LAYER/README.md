# SAR-COTTON-MSLN-4-LAYER — missing color variants

Saranoni handle: `cotton-muslin-4-layer-quilt`

## Volusion import steps

1. Set the product **base price** to the lowest variant price ($52.00 on Saranoni).
2. **Import** `Options_Import.csv` (Inventory → Import/Export → Options). Creates option rows only — no `applytoproductcodes` on Options.
3. **Import** `Products_Import.csv` (Products import). Columns: **`productcode`**, **`optionids`** (comma-separated option IDs).
4. Run `py -3 scripts/fetch_saranoni_variant_import_images.py {code}` to download T/S images into `vspfiles/photos/`, then deploy (push triggers SFTP photo upload).
   Or upload swatch/hero images from `variant_images.csv` manually to `/v/vspfiles/photos/` as `ThumbFile` / `SmallFile`.
5. Re-export Options to confirm IDs, then verify the PDP shows the selector.

## Variants

- **Simple Buds** — option ID `1159`, pricediff `13`, Saranoni $65.00
- **Pine** — option ID `1160`, pricediff `13`, Saranoni $65.00
- **Olive Branch** — option ID `1161`, pricediff `0`, Saranoni $52.00
- **Floral Fields** — option ID `1162`, pricediff `0`, Saranoni $52.00
