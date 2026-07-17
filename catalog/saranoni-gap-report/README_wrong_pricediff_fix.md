# Saranoni wrong variant pricediff — corrected import

## What was missing before

The earlier sheet missed the baby nursery options. Live on **Harry Potter Muslin Nursery** (`SAR-HP-HP-MSLN-NRS`):

- Muslin/Lush Mini **+$700** (should be **+$7**)
- Changing Cover **+$700** (should be **+$7**)
- Crib Sheet **+$1,700** (should be **+$17**)
- Muslin/Lush Quilt **+$5,000** (should be **+$50**)

Also on **Justice League Muslin/Lush** (`SAR-JL-JL-MSLN-LUSH`):

- Quilt **+$4,300** → **+$43**
- XL **+$15,700** → **+$157**

## Correct pricediff rule

`pricediff = Saranoni variant price − McCabe product base price`

Not the full Saranoni price, and not a scaled/absolute number.

## Files to import

1. **`saranoni_wrong_pricediff_fix_options_import.csv`** — Options import with corrected `pricediff` values  
2. Reference audit: **`saranoni_wrong_pricediff_audit.csv`**  
3. Wearable colors still need: **`saranoni_wearable_products_optionids_import.csv`** + photo upload of `SAR-WEARABLE-*-T/S.jpg`

## Leave alone

Shared size IDs `1204` Toddler (+$63) and `1205` XL (+$147) on Batman / Superman / Wizardin World match Saranoni.
