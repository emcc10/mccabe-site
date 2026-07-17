# Saranoni variant/stock batch — 2026-07-16

Generated from a live comparison of saranoni.com (Shopify `.js` product
endpoint, including per-variant `available` stock flags) against the
options currently rendered on each McCabe PDP.

## 1. Options_Import.csv (safe / purely additive)

Import via **Inventory → Import/Export → Options**. Creates option rows
only; does not attach them to any product. Values that already exist
elsewhere in the catalog under the same Option Category with $0 price
diff reuse the existing ID (matches `saranoni_options_import_current.csv`
/ `Saranoni_Options_PriceDiff_Import.csv`); brand-new values were minted
starting at id 1300. **Before importing, re-export your
current Options list from Volusion and confirm none of the minted IDs
are already in use** (this repo does not have live read access to the
full Volusion option-ID range, only to prior export snapshots).

## 2. Products_APPEND_ids.csv — DO NOT IMPORT AS-IS

This file lists, per product code, the option IDs that need to be added.
Volusion's Products import `optionids` column **replaces** a product's
full option list, it does not merge. Before importing:

1. Export current Products (Inventory → Import/Export → Export →
   Products, include the `OptionIDs` column) for every ProductCode in
   this file.
2. For each row, combine the **existing** OptionIDs with the
   `append_optionids` from this file into one comma-separated list.
3. Import that merged list back via Products import.

Skipping step 1–2 and importing this file directly risks wiping out
colors/sizes a product already has assigned.

## 3. Existing_Options_Out_Of_Stock_On_Saranoni.csv

Option values that are **already live and purchasable on McCabe today**
but show `available: false` for every matching variant on saranoni.com.
Recommended action: remove these specific values from the product's
option selector (Options → find the option ID → Delete Assignment for
that ProductCode), or set the product to backorder/hidden if the whole
line is out.

## 4. Fully out-of-stock products (saranoni_fully_out_of_stock_products.csv)

Every variant is unavailable on saranoni.com for these product codes.
Recommended action: set `HideProduct=Y` (or otherwise disable
Add to Cart) until Saranoni restocks.

- `SAR-BMBU-RYN-MSLN-PILLOWCA` — Bamboo Rayon Muslin Pillowcase Sets (hidden today: False)
- `SAR-BMBU-RYN-MSLN-QUEEN-KING` — Bamboo Rayon Muslin Queen King 4-Layer Quilts (hidden today: False)
- `SAR-FX-FUR-PILLOWCA` — Faux Fur Pillowcases (hidden today: False)
- `SAR-PLSH-FX-FUR` — Plush Faux Fur Throw Blankets (hidden today: False)
- `SAR-PTR-RBT-COTTON-MSLN-CRIB` — Peter Rabbit Cotton Muslin Crib Sheets (hidden today: False)
- `SAR-VERY-HGRY-CAT-MNKY-STR` — The Very Hungry Caterpillar Minky Stretch Luxe Blankets (hidden today: True)