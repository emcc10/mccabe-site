Upload these to LIVE via FileZilla, then hard-refresh (Ctrl+Shift+R).

Fingerprint: 20260723mob1

Folder:
  C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\deploy\manual-upload-20260722\to-live

Upload (same remote paths):
1) template_266.html  (Design → File Editor → Save, or FTP to templates root)
2) vspfiles/js/mc-pdp-auth-cta-form.js
3) vspfiles/css/custom-safe.css
4) vspfiles/js/mc-pdp-alt-view-row.js
5) vspfiles/js/mc-bedroom-collection-section.js
6) vspfiles/js/mc-unified-pdp-layout.js

Fixes in this pack (mobile-focused):
- Saranoni: "Receiving" size chip stays one line (narrower XL boxes)
- Saranoni: product name restored after load
- Related items: removed MutationObserver re-hoist flicker
- Closeout: price visible again; ATC/qty ordered under logo (not above)
- Stray native alt under scrolling alt row suppressed when custom row owns thumbs
- Promo banner forced visible on mobile
- Bedroom: The Collection images use real SS-* photo codes (static Cassie/Bear Creek/Highland Park map)
- Bedroom/SS: product title rehomed under logo (not above hero)
- Alt views filtered to current ProductCode (stops unrelated Cassie nightstand/fabric-bed thumbs)
