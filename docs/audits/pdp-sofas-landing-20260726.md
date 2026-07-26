# PDP + landing banner audit — 2026-07-26

**Store:** www.mccabestheaterandliving.com  
**Category audited:** Sofas / Sectionals (`/sectionals-s/139.htm`)  
**Expected PDP order:** title / price → FEATURES + PRODUCT DETAILS accordion → qty + Add to Cart  
**Deploy status:** Fix prepared on branch `cursor/pdp-audit-landing-images-9979` — **not deployed until you confirm**.

---

## Three products audited

| # | Product | Code | Verdict |
|---|---------|------|---------|
| 1 | [Alexandria Chocolate Sofa](https://www.mccabestheaterandliving.com/product-p/ss-alexandria-chocolate-91sofa.htm) | `SS-ALEXANDRIA-CHOCOLATE-91SOFA` | **FAIL** |
| 2 | [Alexandria Power Sectional](https://www.mccabestheaterandliving.com/product-p/ss-alex-choc-pwr-sect.htm) | `SS-ALEX-CHOC-PWR-SECT` | **FAIL** (worst) |
| 3 | [Keily Brown Sofa](https://www.mccabestheaterandliving.com/product-p/ss-keily-brown-86sofa.htm) | `SS-KEILY-BROWN-86SOFA` | **PASS** (when enhancement wins) |

### Product 1 — Alexandria Chocolate Sofa — FAIL
- Main image usually paints (`-1.jpg` exists).
- Broken thumb: `…-2.jpg` (“Main product image”) → **404**.
- Altview probe storm: dozens of `*-altviewN.jpg` **404s** (slots 1–3 exist; probes went far past that).
- `#mc-pdp-purchase-stack` / `#mc-pdp-features` often missing; ATC only via `.mc-atc-button-wrap`.
- Correct accordion→ATC order only when heavy enhancement finishes; otherwise Volusion tabs / qty under price.

### Product 2 — Alexandria Power Sectional — FAIL
- Large top whitespace / gap when enhancement lags.
- Same broken `-2.jpg` thumb + altview 404 storm.
- ATC / qty can sit **above** Product Info tabs (wrong order).
- Layout racey under MutationObserver thrash (needs SS MO neuter + layout that does not depend on observers).

### Product 3 — Keily Brown Sofa — PASS (with caveats)
- When enhanced: title → price → FEATURES → PRODUCT DETAILS → ATC/qty (**correct**).
- Main image healthy; no altview 404 storm in clean runs.
- Still often missing stable `#mc-pdp-*` IDs — same race risk as the others.

### Shared root causes
1. SS MutationObserver thrash freezes the page unless neutered early.
2. With observers neutered, layout that waited on them becomes inconsistent across SKUs.
3. Alexandria catalog points “Main product image” at missing `-2.jpg` (`-1.jpg` / `-2T.jpg` are fine).
4. Generic altview probe up to 64 slots creates a 404 storm on SS SKUs.

---

## Landing banner images (missing)

CMS category Description HTML (`#mc-lp13-*`) points at `/v/vspfiles/landing/*.jpg` files that **404**, so the tan `#d8cbbb` placeholder shows.

| Category | Missing file | Chosen photo (Steve Silver / Coaster) |
|----------|--------------|----------------------------------------|
| 139 Sofas & Sectionals | `mc-sofas-sectionals-hero-20260721.jpg` | `SS-ALEX-STONE-PWR-SECT-1.jpg` |
| 147 / 157 / 199 Loveseats | `mc-loveseats-hero-20260715.jpg` | `SS-NOA800GL-1.jpg` |
| 188 Reclining Sectionals | `mc-reclining-sectionals-hero-20260715.jpg` | `SS-OLSEN-DOVE-PWR-SECT-1.jpg` |

---

## Prepared fix (waiting for your OK to deploy)

1. **`vspfiles/js/mc-ss-pdp-layout.js`** (new) — timeout-only SS layout stabilizer: same accordion + ATC placement every SS product; remaps broken `-2` thumbs; hides native Product Info tabs after mount.
2. **`mc-pdp-alt-view-row.js`** — SS altview probe capped at 8 with early exit on consecutive misses (stops 404 storm).
3. **`mc-pdp-price-stack.js`** — early SS hero + “Main product image” `-2` → `-1` remap.
4. **Landing JPGs** added under `vspfiles/landing/` with the exact CMS filenames above.
5. Template + deploy wiring updated for the new script and landing assets.

**Not deploying until you confirm.** After you say go: merge/deploy, hard-refresh Alexandria sectional + Keily + one loveseat category, confirm banners on 139 / 147 / 188.
