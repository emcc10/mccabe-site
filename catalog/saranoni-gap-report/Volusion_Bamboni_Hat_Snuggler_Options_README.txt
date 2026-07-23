Bamboni Hat + Snuggler Volusion import
======================================

Problem
-------
Snugglewear category (208) links to the long-name SKUs, which have NO variants:

  SAR-BAMBONI-HAT       /product-p/sar-bamboni-hat.htm       - broken (0 options)
  SAR-BAMBONI-SNUGGLER  /product-p/sar-bamboni-snuggler.htm  - broken (0 options)

The short-name SKUs already have the correct options:

  SAR-BMB-HATS          /product-p/sar-bmb-hats.htm
    Color 23: Charcoal=1459, Moonbeam=1012

  SAR-BMB-SNUGGLER      /product-p/sar-bmb-snuggler.htm
    Color 23: Charcoal=1463, Ivory=1091, Light Pink=1119
    Size 58:  Adult=1462

Same duplicate-SKU pattern as Bamboni Sets.

REQUIRED: Products import
-------------------------
File:
  catalog/saranoni-gap-report/Volusion_Bamboni_Hat_Snuggler_Product_Options.csv

Volusion Admin -> Import -> Products
Headers: ProductCode,OptionIDs

After import, hard-refresh:
  https://www.mccabestheaterandliving.com/product-p/sar-bamboni-hat.htm
  https://www.mccabestheaterandliving.com/product-p/sar-bamboni-snuggler.htm

Note: SAR-BAMBONI-SOCKS has the same empty-optionids issue vs SAR-BMB-SOCKS.