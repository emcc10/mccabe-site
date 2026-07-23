Upload these to LIVE via FileZilla, then hard-refresh (Ctrl+Shift+R).

Fingerprint: 20260723close1

Folder:
  C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\deploy\manual-upload-20260722\to-live

REQUIRED for closeout sale PDPs (Tyler bar set, etc.):
1) template_266.html
2) vspfiles/js/mc-pdp-auth-cta-form.js
3) vspfiles/css/custom-safe.css
4) vspfiles/js/mc-pdp-alt-view-row.js

Also (from prior pack, still needed):
5) vspfiles/js/mc-bedroom-collection-section.js
6) vspfiles/js/mc-unified-pdp-layout.js

Closeout fixes in close1:
- Price stack now builds even when mc-pdp-unified-ready is set early
- Info column resolves .vol-product__top--right (legacy closeout markup)
- Order: logo → title → price → qty/ATC → Product Details
- Stale lovey3/sarmob1 script loads can no longer overwrite this FP
- Alt row uses -altviewN only (drops wrong -4/-5/-6 supplier photos)
