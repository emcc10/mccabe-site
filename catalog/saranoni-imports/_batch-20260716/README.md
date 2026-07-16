# Saranoni variant/stock batch — 2026-07-16

Generated from a live comparison of saranoni.com (Shopify `.js` product
endpoint, including per-variant `available` stock flags) against the
options currently rendered on each McCabe PDP.

## 1. Options_Import.csv (single-step, safe / additive)

Import via **Inventory → Import/Export → Options**. Columns:
`id,optioncatid,optionsdesc,pricediff,applytoproductcodes` — the same
format as `saranoni_options_import_current.csv`. The `applytoproductcodes`
column assigns each new option value directly to the listed ProductCodes
in this same import, so there is **no separate Products import step and
nothing to merge by hand.** It only adds this new value to each listed
product; it does not touch or remove any option that product already has.

Values that already exist elsewhere in the catalog under the same Option
Category with a $0 price diff reuse the existing ID (matches
`saranoni_options_import_current.csv` / `Saranoni_Options_PriceDiff_Import.csv`);
brand-new values were minted starting at id 1300.
**Before importing, re-export your current Options list from Volusion and
confirm none of the minted IDs are already in use** (this repo only has
prior export snapshots, not live read access to the full Volusion
option-ID range).

## 2. Existing_Options_Out_Of_Stock_On_Saranoni.csv

Option values that are **already live and purchasable on McCabe today**
but show `available: false` for every matching variant on saranoni.com.
Recommended action: remove these specific values from the product's
option selector (Options → find the option ID → Delete Assignment for
that ProductCode), or set the product to backorder/hidden if the whole
line is out.

## 3. Fully out-of-stock products (saranoni_fully_out_of_stock_products.csv)

Every variant is unavailable on saranoni.com for these product codes.
Recommended action: set `HideProduct=Y` (or otherwise disable
Add to Cart) until Saranoni restocks.

- `SAR-BMBU-RYN-MSLN-PILLOWCA` — Bamboo Rayon Muslin Pillowcase Sets (hidden today: False)
- `SAR-BMBU-RYN-MSLN-QUEEN-KING` — Bamboo Rayon Muslin Queen King 4-Layer Quilts (hidden today: False)
- `SAR-FX-FUR-PILLOWCA` — Faux Fur Pillowcases (hidden today: False)
- `SAR-PLSH-FX-FUR` — Plush Faux Fur Throw Blankets (hidden today: False)
- `SAR-PTR-RBT-COTTON-MSLN-CRIB` — Peter Rabbit Cotton Muslin Crib Sheets (hidden today: False)
- `SAR-VERY-HGRY-CAT-MNKY-STR` — The Very Hungry Caterpillar Minky Stretch Luxe Blankets (hidden today: True)