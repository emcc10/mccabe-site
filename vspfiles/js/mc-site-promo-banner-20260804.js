/**
 * Sitewide #mcPromoBanner restore.
 * Banner-only — does not touch nav or homepage category tiles.
 * Skips Facebook checkout (?fbcheckout=1).
 */
(function (g, d) {
  "use strict";
  if (g.__MC_SITE_PROMO_BANNER__) return;
  g.__MC_SITE_PROMO_BANNER__ = "20260804promo1";

  function ensureSitePromoBanner() {
    try {
      var search = String((g.location && g.location.search) || "");
      if (/(?:^|[?&])fbcheckout=1(?:&|$)/i.test(search)) return;
      if (!d || !d.body) return;
      if (d.getElementById("mcPromoBanner") || d.querySelector(".mc-promo-banner")) return;
      var banner = d.createElement("div");
      banner.id = "mcPromoBanner";
      banner.className = "mc-promo-banner";
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-label", "Current offers");
      banner.innerHTML =
        '<p class="mc-promo-banner__line mc-promo-banner__line--offers">' +
        'Save <span class="mc-promo-banner__num">20%</span> on Select Mahjong Sets with code <span class="mc-promo-banner__num">MAHJ20</span>' +
        '<span class="mc-promo-banner__pipe" aria-hidden="true">|</span>' +
        'Save <span class="mc-promo-banner__num">10%</span> on All Hybrid Mattresses and Bean Bags with code <span class="mc-promo-banner__num">CORD10</span>' +
        '<span class="mc-promo-banner__pipe" aria-hidden="true">|</span>' +
        'Save <span class="mc-promo-banner__num">10%</span> on Saranoni Purchases over <span class="mc-promo-banner__num">$99</span> with code <span class="mc-promo-banner__num">SUMMER</span>' +
        "</p>" +
        '<p class="mc-promo-banner__line mc-promo-banner__line--shipping">' +
        "Free Shipping on all Bean Bags &amp; Mattresses and Saranoni Purchases of " +
        '<span class="mc-promo-banner__num">$99+</span>' +
        "</p>";
      d.body.insertBefore(banner, d.body.firstChild);
    } catch (eBanner) {}
  }

  /* Homepage Game Room must stay on cat 194. Volusion keeps re-serving a stale
     template copy with /category-s/200.htm after admin edits. */
  function fixHomeGameRoomLink() {
    try {
      var path = String((g.location && g.location.pathname) || "").toLowerCase();
      var isHome =
        path === "/" ||
        path === "/default.asp" ||
        path.indexOf("/default.asp") !== -1 ||
        !!(d.body && d.body.classList && d.body.classList.contains("is-home"));
      if (!isHome) return;
      d.querySelectorAll("a[href*='/category-s/200']").forEach(function (a) {
        if (!/game\s*room/i.test(String(a.textContent || ""))) return;
        a.setAttribute("href", "/category-s/194.htm");
      });
    } catch (eGameRoom) {}
  }

  try {
    if (d.body) {
      ensureSitePromoBanner();
      fixHomeGameRoomLink();
    } else {
      d.addEventListener("DOMContentLoaded", function () {
        ensureSitePromoBanner();
        fixHomeGameRoomLink();
      });
    }
    [0, 200, 800, 2000].forEach(function (ms) {
      g.setTimeout(ensureSitePromoBanner, ms);
      g.setTimeout(fixHomeGameRoomLink, ms);
    });
  } catch (eBoot) {}
})(window, document);
