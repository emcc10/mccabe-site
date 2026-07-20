Bamboni Set Volusion import files
=================================

Folder:
  C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\catalog\saranoni-gap-report\

Live product codes:
  SAR-BAMBONI-SETS  ← broken PDP (no variants): /product-p/sar-bamboni-sets.htm
  SAR-BMB-SETS      ← already has variants:     /product-p/sar-bmb-sets.htm

LIVE option IDs (shared):
  Color 23: Charcoal=1444, Taupe=1117
  Size 58:  Small=1443, Medium=1445, Large=1446

----------------------------------------
1) Options import (optional — IDs already exist)
----------------------------------------
File:
  C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\catalog\saranoni-gap-report\Volusion_Bamboni_Set_Options.csv

Volusion: Import → Options
Headers: id,optioncatid,optionsdesc,pricediff
These five rows UPDATE existing options. Skip if you already imported successfully.

----------------------------------------
2) Products import (REQUIRED for SAR-BAMBONI-SETS)
----------------------------------------
File:
  C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\catalog\saranoni-gap-report\Volusion_Bamboni_Set_Product_Options.csv

Volusion: Import → Products
Attaches OptionIDs to both Bamboni Set SKUs:
  SAR-BAMBONI-SETS,"1444,1117,1446,1445,1443"
  SAR-BMB-SETS,"1444,1117,1446,1445,1443"

After import:
  - Enable option inventory control on SAR-BAMBONI-SETS if needed
  - Mark Taupe + Medium OOS in Inventory grid manually (CSV cannot do combo OOS)
