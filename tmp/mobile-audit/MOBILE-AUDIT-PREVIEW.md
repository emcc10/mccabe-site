# Mobile Responsiveness Audit Preview
**Site:** [mccabestheaterandliving.com](https://www.mccabestheaterandliving.com)  
**Date:** June 20, 2026  
**Method:** Live Playwright capture at 320 / 375 / 390 / 768px + CSS/JS repo review

Screenshots: `tmp/mobile-audit/*.png`

---

## Executive summary

The site is **not yet 100% mobile-friendly**. The biggest problem is **category and listing pages**: on a 375px phone, `#content_area` is only **215px wide** (~57% of the screen), so headings, intro copy, subcategory links, and product tiles are squeezed into a narrow left column with large empty space on the right. Product grids render as a **single ~215px column** instead of using the full viewport.

Homepage and PLP also have **chat-widget overlap**, **nav overflow**, and **typography that breaks mid-word**. PDP pages could not be fully automated (Cloudflare bot check), but the codebase shows **conflicting mobile image rules** that likely shift product photos off-center on some devices.

---

## Priority 1 — Critical (fix first)

### 1. Category PLP content column too narrow

| Viewport | `#content_area` width | Expected |
|----------|----------------------|----------|
| 375px    | **215px**            | ~351px (full width minus gutters) |
| Grid     | `grid-template-columns: 215px` (1 col) | `1fr` or `repeat(2, 1fr)` |

**Live DOM chain (375px, `/category-s/177.htm`):**
- `.page-wrap` → 279px (starts at x=48; double horizontal inset)
- `.content_area-wrapper.col-xs-12.col-md-9` → 247px, **`float: left`**
- `#content_area` → 215px
- `.v-product-grid` → 215px

**Symptoms (see `plp-sofas-375.png`, `plp-sofas-375-scroll.png`):**
- “STATIONARY SOFAS” breaks as `STATION` / `ARY` / `SOFAS`
- “Apartment Sofas” breaks as `Apa` / `rtm` / `ent` / `Sofas`
- Intro paragraphs and hero image clipped on the right
- Product tiles stack in one skinny column; titles/prices hard to read

**Likely cause:** Stacked mobile padding on `body`, `.vol-container`, and `.page-wrap` (each +16px) **plus** Bootstrap `float: left` on `.content_area-wrapper.col-md-9` without clearing full width when sidebar is hidden.

**Fix direction:**
```css
@media (max-width: 991px) {
  body.category .content_area-wrapper,
  html.category .content_area-wrapper {
    float: none !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  body, .vol-container, .page-wrap {
    /* use padding on ONE shell only — not all three */
  }
}
```

**Files:** `vspfiles/css/custom-safe.css` (~4255–4335, ~2292–2325), `template_266.html`

---

### 2. Category intro / SEO blocks not responsive

Long-form category copy (Steve Silver, bean bag intros, etc.) uses **desktop-width tables and fixed columns** inside `#content_area`. On mobile:
- Text overflows and is **cut off on the right**
- Banner images appear **narrow or broken** (alt text visible without image)
- Chat widget **covers headings and body copy**

**Fix direction:** Mobile `@media` rules for `#content_area table` → `display: block; width: 100%`, images `max-width: 100%; height: auto`, intro blocks `padding: 0 12px`.

---

### 3. Third-party chat widget overlap

On homepage and PLP, the “Hi! How can we help?” bubble and **“I have a question” / “Tell me more”** buttons sit on top of hero text and category content. The chat icon is also **partially clipped** at the right edge on 320px.

**Fix direction:** Mobile-specific z-index / bottom offset for chat launcher; collapse prompt on scroll; `max-width: calc(100vw - 24px)` on prompt box.

---

## Priority 2 — High

### 4. Homepage hero & navigation (375px)

**See `home-375.png`:**
- Top nav links (`SOFAS & SECTIONALS`, `BEDROOM`, `LUXE COMP…`) **overflow** — last item truncated
- “SELECT A CATEGORY” menu toggle dominates the header
- Hero tagline and chat UI **compete for the same vertical space**

**Files:** `custom-safe.css` hero block (~856–918, ~1985–2110), `template_266.html` mobile float nav

**Fix direction:**
- Hide or hamburger the in-hero desktop nav below 992px (partially done; hero-menu still visible in some states)
- Scale hero logo/tagline with `clamp()` (partially done for tagline)
- Move chat prompt below fold or defer until user taps chat icon

---

### 5. Subcategory link grid breaks words

Subnav uses a 2-column grid with `max-content` columns:

```6890:6905:vspfiles/css/custom-safe.css
:is(html.category, body.category) #content_area nav.menu ul.vnav--level2,
...
  grid-template-columns: repeat(2, minmax(0, max-content)) !important;
  max-width: min(100%, 36rem) !important;
```

Inside a 215px column, link labels break mid-word.

**Fix:** On mobile, single column `grid-template-columns: 1fr` and `white-space: normal; overflow-wrap: normal; word-break: normal`.

---

### 6. Product detail pages (PDP) — code conflicts

Cloudflare blocked automated PDP loads; manual review of CSS shows:

| Issue | Location | Impact |
|-------|----------|--------|
| `margin-left: 65px` on main image | `custom-safe.css` ~3241 | Image shifted right; may clip on small screens |
| Conflicting rules at 768px vs 991px vs 767px | Multiple blocks | Unpredictable layout by device |
| Guest sale price hidden | ~6736–6740 | Guests may see only “member” / list price — verify this matches business rules |
| `#mcPlannerRow` stays `flex-wrap: nowrap` at 767px | ~3204–3208 | Planner + summary may squeeze side-by-side on narrow phones |
| Product tabs had `margin-left: 161px` desktop; reset at 991px | ~11821–11836 | OK on mobile if CSS loads |

**Fix direction:** Remove `margin-left: 65px`; unify breakpoints to **991px**; stack `#mcPlannerRow` / `#mcPlannerRow2` on `<576px`.

---

### 7. Bean bag category banner (`/bean-bag-seating-s/103.htm`)

**See `plp-beanbags-320.png`:**
- Category hero image is **tall and narrow** with heavy side margins
- Body copy over image has **low contrast**
- Large “SELECT A CATEGORY” header consumes above-the-fold space

---

## Priority 3 — Medium

### 8. PLP product grid breakpoints vs actual width

CSS defines sensible grids:

| Breakpoint | Columns |
|------------|---------|
| ≥992px     | 3 |
| 576–991px  | 2 |
| ≤575px     | 1 |

Because `#content_area` is ~215px at 375px, the **576–991px “2 column” rule applies** but each column is ~100px — unusable. Fixing item #1 unlocks this.

**Files:** `custom-safe.css` ~8240–8298, `mccabe-overrides.css` ~1176–1197, `mc-plp-body-last.css`

---

### 9. Fixed PLP image tile heights

Mobile tiles use **220–260px fixed height** with `object-fit: contain`. Very tall or wide products may appear **small inside the box**; extremely wide assets may still feel cropped if older inline CSS (`object-fit: cover`) wins in cache.

Verify deploy order: `mc-plp-body-last.css` and `mccabe-overrides.css` load **after** `custom-safe.css`.

---

### 10. Member / guest pricing visibility

For guests, `.product_sale_price` is hidden on PLP and PDP. Users who want “every price visible” may need:
- **Retail/list price** always shown
- **Member price** with login CTA (already partially implemented via `.mc-member-grid-price`)

Confirm intended behavior vs “show all prices without login.”

---

### 11. Push menu & link tap targets

Historical issue: `preventDefault` on mobile float nav blocked taps (noted in live HTML comments). Current template uses native `<a href>` — **retest** all push-menu links and submenu toggles on real devices.

Submenu carets are hidden on mobile (`custom-safe.css` ~2222+) — ensure parent links still navigate.

---

### 12. Sectional / Palliser / theater PDP variants

Additional surfaces need device QA:
- `#mtl-sectional-configurations` diagram cards
- Leather swatch modal (`#mcLeatherRow`)
- Room planner modal (`#mcPlannerModal`)
- Paragon theater seating (`mc-theater-seating-pdp`, `mc-paragon-pdp`)
- Unified PDP layout (`mc-pdp-unified-ready` at ~17031+)

---

### 13. Related products carousel

Mobile padding `padding: 0 44px` (~7346) may clip cards on 320px — reduce arrow gutter or use `clamp(12px, 4vw, 44px)`.

---

### 14. Breakpoint fragmentation

The codebase mixes **767px, 768px, 575px, 576px, 991px, 992px** across 56+ `@media` blocks in `custom-safe.css` alone. Consolidating to **991/992** (Volusion template breakpoint) reduces edge-case bugs.

---

## What’s working

- Viewport meta tag present
- **No horizontal scroll** detected on tested PLP/home URLs (`docW === winW` at 375px)
- Sidebar correctly hidden on mobile (`display: none`)
- PLP product tiles **do** show title + price when grid has room (3 products detected on sofas PLP)
- Extensive mobile CSS already exists — issues are mostly **layout width** and **content-block responsiveness**, not missing viewport tag

---

## Screenshots reference

| File | Page | Notes |
|------|------|-------|
| `home-375.png` | Homepage | Nav overflow, chat overlap |
| `plp-sofas-375.png` | Stationary Sofas | Narrow column, word breaks |
| `plp-sofas-375-scroll.png` | Same (scrolled) | Intro clipped, chat over text |
| `plp-sofas-375-full.png` | Full page | Full PLP length |
| `plp-beanbags-320.png` | Bean bags | Narrow banner |
| `pdp-beanbag-375.png` | PDP | Cloudflare block (manual test needed) |

---

## Recommended fix order

1. **Unblock full-width content column** on category/listing pages (float + padding stack)
2. **Responsive category intro tables/images**
3. **Chat widget mobile positioning**
4. **Homepage hero nav cleanup**
5. **PDP image margin + planner row stacking**
6. **Breakpoint consolidation pass**
7. **Device QA pass** on sectional, Palliser, checkout, search, My Boards

---

## Next step

I can implement Priority 1 (full-width mobile PLP column + intro block fixes) in `custom-safe.css` and deploy via your usual Volusion push workflow. Say the word if you want that started.
