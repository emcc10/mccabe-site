# The Mahjong House product descriptions

Official copy sourced from [themahjonghouse.com](https://themahjonghouse.com) (Shopify `body_html`), matched to Volusion `TMH-*` product codes.

## Live PDP override

`vspfiles/js/mc-tmh-product-descriptions.js` is loaded on Mahjong House PDPs and writes the official description into the **Product Details** accordion.

## Permanent catalog import (optional)

In Volusion admin → Inventory → Import/Export → Products, import `Products_Description_Import.csv` (update existing products by product code).

Current map: **100** products. Unmatched: **2**.

Regenerate:

```bash
python3 scripts/build_tmh_descriptions.py
```
