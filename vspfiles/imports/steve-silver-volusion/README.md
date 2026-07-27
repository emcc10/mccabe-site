# Steve Silver → Volusion import pack

## Spreadsheets
Import packs include **Available** Steve Silver products only (Out of Stock excluded).

- **`McCabe_SteveSilver_Import_AvailableOnly.xlsx`** / `.csv` — Excel-ready Volusion import (**23 Available SKUs only**)
- `McCabe_SteveSilver_Import.xlsx` / `.csv` — same Available-only content (legacy filename)
- `steve_silver_game_table_sets_import.csv` — game table sets only (Rylie, Tournament, Cambridge)
- `steve_silver_dining_groups_import.csv` — Colvin, Magnolia, Reid, Napa, Garland, Aubrey, Ventura, Artemis (+ servers/curios)
- `steve_silver_game_dining_server_import.csv` / `.xlsx` — full combined workbook
- `servers_on_site_format_notes.csv` — existing McCabe server SKUs and required edits

## Columns
`productcode, productname, productprice, productweight, freeshipping, availability, productdescription, techspecs`
(plus helper columns: `group, vendor_sku, source_url, volusion_images`)

- **productdescription** = Steve Silver short description (e.g. Rylie “Get ready for game night…”)
- **techspecs** = bullet list starting at “Set includes…” / crafted specs
- **productprice / productweight** often blank — Steve Silver retailer site does not expose dealer MAP/weight for most bundles; fill from your cost sheet before import
- **freeshipping** = `N`, **availability** = `Available` only — Out of Stock Steve Silver pages are excluded from these import files

## Images
Downloaded into `vspfiles/photos/` as Volusion names:
- `{productcode}-1.jpg` main
- `{productcode}-2T.jpg` thumbnail proxy
- `{productcode}-altview1.jpg` … alt views

## Existing servers on site
- `SS-BUR500NSV` = **Burlington** Cathedral Doored Server (vendor `BUR500NSV`). Live McCabe currently mislabels this SKU as Magnolia — fix title/description.
- Magnolia servers use `SS-MM520*` (e.g. `SS-MM520KSV`), not BUR500.
- `SS-AUB500SV` should follow Aubrey Server copy (`SS-ABR500KSV`).


## FileZilla / Volusion SFTP location
After deploy, open FileZilla to the store SFTP and go to:

`/vspfiles/imports/steve-silver-volusion/`

(Web URL equivalent: `/v/vspfiles/imports/steve-silver-volusion/`)

Product images: `/vspfiles/photos/`

## Rebuild
```bash
python3 scripts/build_ss_volusion_import.py
```
