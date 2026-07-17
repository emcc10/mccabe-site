# Wearable Products OptionIDs import (Volusion)

## Columns (Volusion Products import)

| Column | Required | Value |
|--------|----------|-------|
| `ProductCode` | Y | `SAR-WEARABLE` |
| `OptionIDs` | Y | `1411,1412,1413,1414,1049,1154,1155` |
| `EnableOptions_InventoryControl` | Y | `Y` |

Option IDs: sizes `1411–1414`, colors `1049` Feather, `1154` Cream, `1155` Hazel.

## Which file to use

1. **Open / check in Excel (recommended):**  
   `saranoni_wearable_products_optionids_import.csv`  
   or `saranoni_wearable_products_optionids_import_excel_safe.tsv`  

   OptionIDs is stored as an Excel text formula so it stays  
   `1411,1412,1413,1414,1049,1154,1155`  
   instead of one giant number.

   After confirming in Excel: **File → Save As → CSV (Comma delimited)**  
   then import that saved CSV in Volusion (Excel writes the displayed text value).

2. **Import straight into Volusion (do not open in Excel first):**  
   `saranoni_wearable_products_optionids_import_volusion_raw.csv`

## Do not

- Double-click the raw CSV and Save if Excel turned OptionIDs into one number — that corrupts the import.
