# SAR-SATIN-BACK-TOD — missing color variants

Saranoni handle: `satin-back-toddler-blanket`

## Volusion import steps

1. Set the product **base price** to the lowest variant price ($76.50 on Saranoni).
2. **Import** `Options_Import.csv` (Inventory → Import/Export → Options). Creates option rows only — no `applytoproductcodes` on Options.
3. **Import** `Products_Import.csv` (Products import). Columns: **`productcode`**, **`optionids`** (comma-separated option IDs).
4. Run `py -3 scripts/fetch_saranoni_variant_import_images.py {code}` to download T/S images into `vspfiles/photos/`, then deploy (push triggers SFTP photo upload).
   Or upload swatch/hero images from `variant_images.csv` manually to `/v/vspfiles/photos/` as `ThumbFile` / `SmallFile`.
5. Re-export Options to confirm IDs, then verify the PDP shows the selector.

## Variants

- **Navy Twinkle Star** — option ID `1163`, pricediff `0`, Saranoni $76.50
- **Dainty Floral** — option ID `1164`, pricediff `0`, Saranoni $76.50
- **Sun and Sea** — option ID `1165`, pricediff `0`, Saranoni $76.50
- **Tulip** — option ID `1166`, pricediff `0`, Saranoni $76.50
- **Daisy** — option ID `1167`, pricediff `0`, Saranoni $76.50
- **Cedar** — option ID `1168`, pricediff `0`, Saranoni $76.50
- **Camo** — option ID `1169`, pricediff `0`, Saranoni $76.50
- **Flora** — option ID `1170`, pricediff `0`, Saranoni $76.50
- **Sea Glass** — option ID `1171`, pricediff `0`, Saranoni $76.50
