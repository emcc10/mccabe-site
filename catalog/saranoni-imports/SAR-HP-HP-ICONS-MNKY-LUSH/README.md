# SAR-HP-HP-ICONS-MNKY-LUSH — missing size variants

Saranoni handle: `harry-potter-icons-minky-lush`

## Volusion import steps

1. Set the product **base price** to the lowest variant price ($32.00 on Saranoni).
2. **Import** `Options_Import.csv` (Inventory → Import/Export → Options). Creates option rows only — no `applytoproductcodes` on Options.
3. **Import** `Products_Import.csv` (Products import). Column **`applytoproductcodes`** = comma-separated **option IDs** for this SKU.
4. Run `py -3 scripts/fetch_saranoni_variant_import_images.py {code}` to download T/S images into `vspfiles/photos/`, then deploy (push triggers SFTP photo upload).
   Or upload swatch/hero images from `variant_images.csv` manually to `/v/vspfiles/photos/` as `ThumbFile` / `SmallFile`.
5. Re-export Options to confirm IDs, then verify the PDP shows the selector.

Size option IDs **1202–1205** (Mini / Receiving / Toddler / XL) are reused across licensed Minky/Lush SKUs (SAR-WIZARDIN-WORLD-CHARM, SAR-HP-HP-ICONS-MNKY-LUSH). Import Options once from `_batch/Options_Import.csv`, then import each product row from `_batch/Products_Import.csv` (or this SKU's `Products_Import.csv` only).

## Variants

- **Mini** — option ID `1202`, pricediff `0`, Saranoni $32.00
- **Receiving** — option ID `1203`, pricediff `33`, Saranoni $65.00
- **Toddler** — option ID `1204`, pricediff `63`, Saranoni $95.00
- **XL** — option ID `1205`, pricediff `147`, Saranoni $179.00
