# Remaining Saranoni pricediff fix

Import into **Inventory → Import/Export → Options** (same columns as Options export):

`id,optioncatid,optionsdesc,pricediff,applytoproductcodes`

File: `saranoni_remaining_pricediff_fix_options_import.csv`

| ID | Option | Was | Correct |
|----|--------|-----|---------|
| 1337 / 1257 | Amelia | 1790 | 17.9 |
| 1338 / 1258 | Jack | 1790 | 17.9 |
| 1339 / 1259 | Simple Buds | 1300 | 13 |
| 1340 / 1260 | Pine | 1300 | 13 |
| 1465 | Classic Leopard | 10 | 0 |
| 1496 | Swaddle | 16.13 | 14 |
| 1497 | Juniper | 16.13 | 0 |

`1159` / `1160` already have correct Simple Buds / Pine (+13). Prefer those on `SAR-COTTON-MSLN-4-LAYER` if both ID sets are attached.
