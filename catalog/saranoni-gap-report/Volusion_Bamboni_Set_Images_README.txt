Bamboni Sets (SAR-BAMBONI-SETS) — images to SFTP upload
=======================================================

Why variants/alts look broken on:
  https://www.mccabestheaterandliving.com/product-p/sar-bamboni-sets.htm

1) VARIANT / COLOR SWATCH IMAGES — MISSING ON CDN
   Volusion looks for:
     SAR-BAMBONI-SETS-{OptionID}-T.jpg  (large / hero swap)
     SAR-BAMBONI-SETS-{OptionID}-S.jpg  (small swatch)
   CDN currently has these for SAR-BMB-SETS only, NOT for SAR-BAMBONI-SETS.
   Charcoal=1444, Taupe=1117.

2) ALT VIEW FILES — ALREADY ON CDN
   SAR-BAMBONI-SETS-altview1.jpg … altview8.jpg return HTTP 200.
   The custom under-hero alt row is not mounting on this Saranoni PDP
   (code/CSS issue). Native #altviews is hidden once color swatches are ready.
   Uploading altviews again will not fix display by itself.

----------------------------------------
UPLOAD THESE FILES (variant images)
----------------------------------------
Local staging folder (ready to SFTP into /v/vspfiles/photos/):

  C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\catalog\saranoni-gap-report\bamboni-sets-images-to-upload\

Also copied into:

  C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\vspfiles\photos\

Required (were 404 on live):
  SAR-BAMBONI-SETS-1444-T.jpg
  SAR-BAMBONI-SETS-1444-S.jpg
  SAR-BAMBONI-SETS-1117-T.jpg
  SAR-BAMBONI-SETS-1117-S.jpg

Optional (already live; included in staging for convenience):
  SAR-BAMBONI-SETS-altview1.jpg … SAR-BAMBONI-SETS-altview8.jpg

SFTP destination:
  /v/vspfiles/photos/

After upload, hard-refresh the PDP. Color swatch thumbs should load.
Alt-under-hero row still needs a code fix later (you asked not to touch CSS/JS/template).

Working duplicate product (already has variant images):
  https://www.mccabestheaterandliving.com/product-p/sar-bmb-sets.htm
