/**
 * PLP fixes — DOM-driven, scoped to inspected Volusion markup.
 * MC_PLP_ENFORCER_20260711001 — L3 flyout right + load auth hotfix when stale
 *
 * Thumbnails: .mc-plp-image-box; image element sized to the wrapper, object-fit: contain (no crop).
 *
 * 2026-07-07: VERSION bumped to a monotonically increasing integer (YYYYMMDDNNN)
 * instead of a date+letter suffix (e.g. "20260706c"). The old scheme broke the
 * self-upgrade check below: plpVerNum() strips all non-digit characters, so
 * "20260706a" and "20260706c" BOTH reduced to the number 20260706 and compared
 * as equal — the loader believed the newer "c" file was already running and
 * silently refused to fetch it, leaving stale cached JS live indefinitely
 * regardless of FTP uploads. Always increment the trailing NNN for any new
 * deploy; never reuse a date+letter suffix again.
 */
(function (global) {
  "use strict";

  var VERSION = "20260711001";

  function plpVerNum(v) {
    var n = parseInt(String(v || "").replace(/\D/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }

  var PLP_MAT = "#ffffff";
  if (plpVerNum(global.__MC_PLP_ENFORCER_VER__) >= plpVerNum(VERSION)) return;
  global.__MC_PLP_ENFORCER_VER__ = VERSION;
  global.__MC_PLP_ENFORCER__ = true;

  /* Defer Stripe on browse pages (home, PLP, etc). Keep on PDP/cart/checkout.
     Early template block must run first; this is a late safety net. */
  (function skipStripeOnBrowse() {
    function needsStripeNow() {
      try {
        if (global.__MC_SKIP_STRIPE_ON_PLP__) return false;
        var p = String(global.location.pathname || "").toLowerCase();
        if (/\/product-p\//.test(p) || /\/[^/]+-p\/[^/]+\.html?$/.test(p)) return true;
        if (/shoppingcart|checkout|one-page-checkout|paymentform|orderform|paypal/.test(p)) return true;
        if (/\.asp$/i.test(p) && /cart|check|pay|order|bill/i.test(p)) return true;
      } catch (e) {}
      return false;
    }
    if (needsStripeNow()) return;
    global.__MC_SKIP_STRIPE_ON_PLP__ = true;
    function shouldBlock(src) {
      return /js\.stripe\.com|stripe-push-cart|vpay-request-button/i.test(String(src || ""));
    }
    function neuter(node) {
      if (!node || node.tagName !== "SCRIPT") return;
      var src = "";
      try {
        src = String(node.getAttribute("src") || "");
      } catch (eS) {}
      if (!shouldBlock(src)) return;
      try {
        node.type = "text/plain";
        node.removeAttribute("src");
        node.setAttribute("data-mc-stripe-deferred", "1");
      } catch (eN) {}
    }
    try {
      document.querySelectorAll("script[src]").forEach(neuter);
    } catch (eQ) {}
  })();

  function injectCriticalThumbCss() {
    if (document.getElementById("mc-plp-critical-css")) return;
    var s = document.createElement("style");
    s.id = "mc-plp-critical-css";
    s.textContent =
      "html.category #content_area .v-product-grid a.v-product__img.mc-plp-image-box," +
      "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img.mc-plp-image-box{" +
      "display:flex!important;align-items:center!important;justify-content:center!important;" +
      "width:100%!important;height:280px!important;overflow:visible!important;background:#fff!important;padding:0!important}" +
      "html.category #content_area .v-product-grid a.v-product__img.mc-plp-image-box>img," +
      "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img.mc-plp-image-box>img{" +
      "width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;" +
      "object-fit:contain!important;object-position:center center!important;transform:none!important;" +
      "border:none!important;box-shadow:none!important;background:transparent!important}";
    (document.head || document.documentElement).appendChild(s);
  }

  (function injectPlpBodyLastCss() {
    function attach() {
      if (isCloseoutSalePlp()) return;
      injectCriticalThumbCss();
      if (document.getElementById("mc-plp-body-last-css")) return;
      var l = document.createElement("link");
      l.id = "mc-plp-body-last-css";
      l.rel = "stylesheet";
      l.href = "/v/vspfiles/css/mc-plp-body-last.css?v=" + VERSION;
      (document.body || document.documentElement).appendChild(l);
    }
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach);
  })();

  var TARGET_VISIBLE_W = 300;
  var BOX_HEIGHT = 280;
  var NORMALIZED_W = 420;
  var NORMALIZED_H = 260;
  var BOUNDS_JSON = "/v/vspfiles/js/mc-plp-sofa-bounds.json";
  var BOUNDS_SAMPLE = 320;

  var boundsMap = null;
  var boundsMapLoading = false;
  var boundsMapWaiters = [];

  function isCloseoutSalePlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      var s = String(global.location.search || "").toLowerCase();
      if (/\/category-s\/181\.htm/i.test(p)) return true;
      if (/searchresults\.asp/i.test(p) && /(?:^|[?&])cat=181(?:&|$)/.test(s)) return true;
    } catch (eCo) {}
    return false;
  }

  function isCategoryPlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      var body = global.document.body;
      if (body && body.classList.contains("productdetails")) return false;
      if (/(?:-p\/|product-p\/)/.test(p)) return false;
      if (/(?:shoppingcart|one-page-checkout|checkout|orderconfirm)/i.test(p)) return false;
      if (p === "/" || p === "/default.asp" || p === "/default.aspx") return false;
      if (/\/index\.html?$/i.test(p)) return false;
      if ((/-s\//.test(p) || /category-s\//.test(p)) && /\.html?/i.test(p)) return true;
      if (/productslist\.asp|searchresults\.asp/.test(p)) return true;
      if (
        global.document.documentElement &&
        global.document.documentElement.classList.contains("vol-list")
      ) {
        return true;
      }
      var root = global.document.getElementById("content_area");
      if (root) {
        if (
          root.querySelector(
            ".v-product-grid a.v-product__img, .v-product-grid .v-product__img, ul.v-product-grid li.v-product"
          )
        ) {
          return true;
        }
        if (
          root.querySelector("table.v65-productDisplay") &&
          /Grid_Single_Divider/i.test(root.innerHTML)
        ) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function isHome() {
    if (isCategoryPlp()) return false;
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      if (p === "/" || p === "/default.asp" || p === "/default.aspx") return true;
      if (/\/index\.html?$/i.test(p)) return true;
      if (global.mcPathIsHomepage && global.mcPathIsHomepage()) return true;
    } catch (e2) {}
    return false;
  }

  function markCategory() {
    if (!isCategoryPlp()) return;
    document.documentElement.classList.add("category");
    document.documentElement.setAttribute("data-mc-category-plp", "1");
    if (document.body) {
      document.body.classList.add("category");
      document.body.setAttribute("data-mc-category-plp", "1");
      document.body.classList.remove("is-home");
    }
    document.documentElement.classList.remove("mc-allow-home-hero");
  }

  function repairCartFloatIcon() {
    // No-op as of 2026-07-04: this used to force the cart float to 52px /
    // position:static, but a native template script (template.min.js) now
    // owns cart sizing/position at 42px / position:fixed on its own ~100ms
    // interval. The two fought continuously (confirmed via live stack trace
    // — this function re-fires on every category-page DOM mutation), which
    // is what visibly "glitched" the cart icon. Do not restore this body;
    // template.min.js already handles the cart correctly on its own.
  }

  function isLegacySubcatChromeTable(tbl) {
    if (!tbl) return false;
    if (tbl.querySelector('img[src*="SearchResults_SubCat_Angle"]')) return true;
    if (
      String(tbl.getAttribute("width") || "") === "215" &&
      tbl.querySelector("td.colors_lines_light")
    ) {
      return true;
    }
    if (
      tbl.querySelector('img[src*="clear1x1.gif"][width="15"][height="15"]') &&
      tbl.querySelector("td.colors_lines_light")
    ) {
      return true;
    }
    return false;
  }

  function looksLikeProductTable(tbl) {
    if (!tbl || !tbl.querySelector) return false;
    if (
      tbl.querySelector(
        'a[href*="-p/"], a[href*="product-p/"], a.productnamecolor, .v-product, .productnamecolor, .v-product-grid'
      )
    ) {
      return true;
    }
    var imgs = tbl.querySelectorAll("img");
    var i;
    for (i = 0; i < imgs.length; i++) {
      var src = (imgs[i].getAttribute("src") || "").toLowerCase();
      if (!src) continue;
      if (src.indexOf("clear1x1") !== -1) continue;
      if (src.indexOf("searchresults_subcat_angle") !== -1) continue;
      if (src.indexOf("divider_horizontal") !== -1) continue;
      return true;
    }
    return false;
  }

  function removeLegacyCategoryBars() {
    document.querySelectorAll("table.colors_backgroundlight").forEach(function (tbl) {
      if (isLegacySubcatChromeTable(tbl)) {
        tbl.parentNode.removeChild(tbl);
        return;
      }

      if (looksLikeProductTable(tbl)) return;
      Array.prototype.forEach.call(tbl.rows, function (tr) {
        var td = tr.querySelector("td.colors_lines_light");
        if (!td) return;
        var img = td.querySelector('img[src*="clear1x1"]');
        if (!img) return;
        tr.parentNode.removeChild(tr);
      });
    });

    var scope = document.getElementById("content_area");
    if (!scope) return;
    var child;
    for (child = scope.firstElementChild; child; child = child.nextElementSibling) {
      if (child.tagName !== "TABLE") continue;
      Array.prototype.forEach.call(child.rows, function (tr) {
        if (tr.cells.length !== 1) return;
        var td = tr.cells[0];
        if (!td.classList.contains("colors_lines_light")) return;
        var img = td.querySelector('img[src*="clear1x1"]');
        if (!img) return;
        tr.parentNode.removeChild(tr);
      });
    }
  }

  function photoFilename(src) {
    var m = String(src || "").match(/\/photos\/([^?#]+)/i);
    return m ? m[1].toLowerCase() : "";
  }

  function sameOriginPhotoUrl(filename) {
    return "/v/vspfiles/photos/" + filename;
  }

  function withBoundsMap(cb) {
    if (boundsMap) {
      cb(boundsMap);
      return;
    }
    boundsMapWaiters.push(cb);
    if (boundsMapLoading) return;
    boundsMapLoading = true;
    fetch(BOUNDS_JSON + "?v=" + VERSION, { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (map) {
        boundsMap = map || {};
        boundsMapLoading = false;
        var waiters = boundsMapWaiters.slice();
        boundsMapWaiters.length = 0;
        waiters.forEach(function (fn) {
          fn(boundsMap);
        });
      });
  }

  function isProductPhoto(img) {
    var src = String(img.currentSrc || img.src || "").toLowerCase();
    return /vspfiles\/photos\//.test(src) || /vspfiles\/product\//.test(src);
  }

  function isNoPhotoPlaceholder(src) {
    return /nophoto/i.test(String(src || ""));
  }

  function injectVolusionProductGridStyle() {
    if (document.getElementById("mc-volusion-plp-grid-style")) return;
    var s = document.createElement("style");
    s.id = "mc-volusion-plp-grid-style";
    s.textContent =
      ".v-product-grid .v-product{margin-left:-4px;display:inline-block;vertical-align:top;width:33.3333333333%;padding:15px 5px;box-sizing:border-box;}" +
      ".v-product-grid img{vertical-align:middle;}" +
      "@media (max-width:480px){.v-product-grid .v-product{width:100%;}}" +
      ".v-product__img img{max-width:100%;margin:0 auto 15px;}" +
      ".v-product-grid .v-product__title{display:block;word-wrap:break-word;}";
    (document.head || document.documentElement).appendChild(s);
  }

  function splitGridSingleBlocks(table) {
    var rows = [];
    var tbody = table.tBodies[0] || table;
    Array.prototype.forEach.call(tbody.rows, function (tr) {
      rows.push(tr);
    });
    var blocks = [];
    var current = [];
    rows.forEach(function (tr) {
      current.push(tr);
      if (/Grid_Single_Divider_Horiz/i.test(tr.innerHTML || "")) {
        if (current.length) blocks.push(current);
        current = [];
      }
    });
    if (current.length) blocks.push(current);
    return blocks;
  }

  function legacySkuFromRows(blockRows) {
    var html = "";
    var i;
    for (i = 0; i < blockRows.length; i++) {
      html += blockRows[i].innerHTML || "";
    }
    var m = html.match(/VCompare\s*\(\s*['"]([^'"]+)['"]/i);
    if (m) return String(m[1]).trim();
    for (i = 0; i < blockRows.length; i++) {
      var a = blockRows[i].querySelector(
        "a.productnamecolor[title], a.colors_productname[title]"
      );
      if (a) {
        var sku = skuFromProductTitle(a.getAttribute("title") || "");
        if (sku) return sku;
      }
    }
    return "";
  }

  function findLegacyImageLink(blockRows) {
    var i;
    for (i = 0; i < blockRows.length; i++) {
      var cand = blockRows[i].querySelector(
        'td[rowspan] a[href*="product-p/"], td[rowspan] a[href*="-p/"]'
      );
      if (cand && cand.querySelector("img")) return cand;
    }
    return null;
  }

  function findLegacyTitleLink(blockRows) {
    var i;
    for (i = 0; i < blockRows.length; i++) {
      var a = blockRows[i].querySelector("a.productnamecolor, a.colors_productname");
      if (a) return a;
    }
    return null;
  }

  function extractLegacyPriceHtml(blockRows) {
    var i;
    for (i = 0; i < blockRows.length; i++) {
      if (
        !blockRows[i].querySelector(
          ".product_productprice, .product_saleprice, .colors_productprice"
        )
      ) {
        continue;
      }
      var td = blockRows[i].querySelector("td[valign]");
      if (td) return td.innerHTML;
    }
    return "";
  }

  function findLegacyVCompareScript(blockRows) {
    var i;
    for (i = 0; i < blockRows.length; i++) {
      var scripts = blockRows[i].querySelectorAll("script");
      var j;
      for (j = 0; j < scripts.length; j++) {
        if (/VCompare\s*\(/i.test(scripts[j].textContent || "")) return scripts[j];
      }
    }
    return null;
  }

  function scoreLegacyProductTable(tbl) {
    if (!tbl || tbl.querySelector(".v-product-grid")) return 0;
    var html = tbl.innerHTML || "";
    if (!/Grid_Single_Divider/i.test(html)) return 0;
    var horiz = (html.match(/Grid_Single_Divider_Horiz/gi) || []).length;
    var rows = 0;
    try {
      var tbody = tbl.tBodies[0] || tbl;
      rows = tbody.rows ? tbody.rows.length : 0;
    } catch (eScore) {}
    return horiz * 100 + rows;
  }

  function findLegacyGridSingleProductTable(root) {
    var tables = root.querySelectorAll("table.v65-productDisplay");
    var best = null;
    var bestScore = 0;
    var i;
    for (i = 0; i < tables.length; i++) {
      var score = scoreLegacyProductTable(tables[i]);
      if (score > bestScore) {
        bestScore = score;
        best = tables[i];
      }
    }
    return best;
  }

  function isEmptyVolusionShellTable(tbl) {
    if (!tbl || tbl.tagName !== "TABLE") return false;
    if (!tbl.querySelector(".v-product-grid")) return false;
    if (tbl.querySelector("table.v65-productDisplay .v-product-grid")) return false;
    if (tbl.querySelector("form.search_results_section, #mc-cat-luxe-comforts, footer.footer")) {
      return false;
    }
    return tbl.rows.length <= 1;
  }

  /** Only unwrap single-cell product-list tables — never hoist grid out of #content_area. */
  function unwrapProductGridShell(grid) {
    var node = grid;
    var contentArea = document.getElementById("content_area");
    var guard = 0;
    while (node && guard < 2) {
      guard += 1;
      if (contentArea && (node.parentElement === contentArea || !contentArea.contains(node))) break;

      var parent = node.parentElement;
      if (!parent || parent.tagName !== "TD" || parent.childElementCount !== 1) break;

      var tr = parent.parentElement;
      var tbl = tr && tr.parentElement;
      if (
        !tr ||
        tr.tagName !== "TR" ||
        !tbl ||
        tbl.tagName !== "TABLE" ||
        !isEmptyVolusionShellTable(tbl)
      ) {
        break;
      }
      if (contentArea && !contentArea.contains(tbl)) break;

      var outer = tbl.parentElement;
      if (!outer) break;
      outer.replaceChild(node, tbl);
    }
  }

  function getCategoryPageWrap() {
    return (
      document.querySelector("article.vol-container .page-wrap") ||
      document.querySelector(".page-wrap")
    );
  }

  function repairOrphanProductGrid() {
    var contentArea = document.getElementById("content_area");
    var grid =
      document.getElementById("mc-products-start") ||
      document.querySelector("#content_area .v-product-grid");
    if (!contentArea || !grid || contentArea.contains(grid)) return;

    var form = contentArea.querySelector("form.search_results_section");
    if (form) {
      form.appendChild(grid);
      return;
    }
    contentArea.appendChild(grid);
  }

  /** Baked cat HTML can pop footer out of .page-wrap; re-home it for theme CSS. */
  function repairCategoryPageShell() {
    if (!isCategoryPlp()) return false;
    var pageWrap = getCategoryPageWrap();
    var volInner = document.querySelector("article.vol-container > section.vol-inner");
    var footer =
      document.querySelector("footer.footer[data-ui-block='footer-1']") ||
      document.querySelector("footer.footer");
    var container = document.querySelector(".container.container--content");
    var contentArea = document.getElementById("content_area");
    if (!pageWrap || !footer) return false;

    var changed = false;

    repairOrphanProductGrid();

    contentArea
      .querySelectorAll("footer.footer")
      .forEach(function (dup) {
        if (dup !== footer && dup.parentNode) {
          dup.parentNode.removeChild(dup);
          changed = true;
        }
      });

    if (volInner && pageWrap.parentElement !== volInner) {
      volInner.appendChild(pageWrap);
      changed = true;
    }

    if (footer.parentElement !== pageWrap) {
      pageWrap.appendChild(footer);
      changed = true;
    }

    if (container && container.parentElement !== pageWrap) {
      pageWrap.insertBefore(container, footer);
      changed = true;
    } else if (!container && contentArea) {
      container = document.createElement("div");
      container.className = "container container--content";
      var row = document.createElement("div");
      row.className = "row";
      var wrap = document.querySelector("section.content_area-wrapper");
      if (!wrap || !wrap.contains(contentArea)) {
        wrap = document.createElement("section");
        wrap.className = "content_area-wrapper col-xs-12 col-md-9";
        wrap.setAttribute("role", "main");
        wrap.appendChild(contentArea);
      }
      row.appendChild(wrap);
      container.appendChild(row);
      pageWrap.insertBefore(container, footer);
      changed = true;
    }

    if (container && footer.parentElement === pageWrap && container.nextSibling !== footer) {
      pageWrap.insertBefore(footer, container.nextSibling);
      changed = true;
    }

    /* Stray </section></div> in baked cat HTML pops #content_area out of .container — footer loses theme CSS. */
    if (container && contentArea && !container.contains(contentArea)) {
      var row = container.querySelector(":scope > .row");
      if (!row) {
        row = container.querySelector(".row");
      }
      if (!row) {
        row = document.createElement("div");
        row.className = "row";
        container.appendChild(row);
      }
      var areaWrap = container.querySelector("section.content_area-wrapper");
      if (!areaWrap) {
        areaWrap = document.querySelector("section.content_area-wrapper");
      }
      if (!areaWrap || areaWrap.contains(footer)) {
        areaWrap = document.createElement("section");
        areaWrap.className = "content_area-wrapper col-xs-12 col-md-9";
        areaWrap.setAttribute("role", "main");
      }
      if (!areaWrap.contains(contentArea)) {
        areaWrap.appendChild(contentArea);
      }
      if (!row.contains(areaWrap)) {
        row.appendChild(areaWrap);
      }
      changed = true;
    }

    pageWrap.querySelectorAll(":scope > nav.push-menu").forEach(function (strayNav) {
      if (strayNav.parentElement === pageWrap && footer && strayNav !== footer) {
        pageWrap.insertBefore(strayNav, footer);
        changed = true;
      }
    });

    return changed;
  }

  function injectLegacyPlpLayoutFixCss() {
    if (document.getElementById("mc-legacy-plp-layout-fix")) return;
    var s = document.createElement("style");
    s.id = "mc-legacy-plp-layout-fix";
    s.textContent =
      "html.category #content_area #mc-products-start.v-product-grid," +
      "html[data-mc-category-plp='1'] #content_area #mc-products-start.v-product-grid," +
      "html.category #content_area .v-product-grid," +
      "html[data-mc-category-plp='1'] #content_area .v-product-grid{" +
      "display:block!important;width:100%!important;max-width:100%!important;" +
      "margin:0!important;padding:0!important;clear:both!important}" +
      "html.category #content_area table.v65-productDisplay:has(.v-product-grid)," +
      "html[data-mc-category-plp='1'] #content_area table.v65-productDisplay:has(.v-product-grid)," +
      "html.category #content_area table[cellpadding='8']:has(.v-product-grid)," +
      "html[data-mc-category-plp='1'] #content_area table[cellpadding='8']:has(.v-product-grid){" +
      "width:100%!important;margin:0!important;padding:0!important;border-collapse:collapse!important}" +
      "html.category #content_area table:has(.v-product-grid)>tbody>tr>td," +
      "html[data-mc-category-plp='1'] #content_area table:has(.v-product-grid)>tbody>tr>td," +
      "html.category #content_area table:has(.v-product-grid)>tr>td," +
      "html[data-mc-category-plp='1'] #content_area table:has(.v-product-grid)>tr>td{" +
      "padding:0!important;vertical-align:top!important}" +
      "html.category #mc-cat-luxe-comforts," +
      "html[data-mc-category-plp='1'] #mc-cat-luxe-comforts{" +
      "max-width:100%!important;overflow:hidden!important}" +
      "html.category .footer," +
      "html[data-mc-category-plp='1'] .footer," +
      "html.category footer.footer," +
      "html[data-mc-category-plp='1'] footer.footer," +
      "html.category .page-wrap > footer.footer," +
      "html[data-mc-category-plp='1'] .page-wrap > footer.footer{" +
      "width:100%!important;max-width:100%!important;clear:both!important;" +
      "margin-left:0!important;margin-right:0!important;position:relative!important;" +
      "left:auto!important;right:auto!important;float:none!important;" +
      "display:block!important}" +
      "html.category footer.footer svg.icon," +
      "html[data-mc-category-plp='1'] footer.footer svg.icon," +
      "html.category .vnav__arrow img," +
      "html[data-mc-category-plp='1'] .vnav__arrow img{" +
      "max-width:28px!important;max-height:28px!important;width:auto!important;height:auto!important}";
    (document.head || document.documentElement).appendChild(s);
  }

  function collapsePlpGridGap(root) {
    var grid = root.querySelector("#mc-products-start, .v-product-grid");
    if (!grid) return;

    var node = grid;
    var guard = 0;
    while (node && node !== root && guard < 14) {
      guard += 1;
      if (node.style) {
        node.style.setProperty("padding-top", "0", "important");
        node.style.setProperty("margin-top", "0", "important");
      }
      node = node.parentElement;
    }

    root.querySelectorAll("table[cellpadding='8'], table.v65-productDisplay").forEach(function (tbl) {
      if (!tbl.querySelector(".v-product-grid, .v-product")) return;
      if (tbl.style) {
        tbl.style.setProperty("margin-top", "32px", "important");
        tbl.style.setProperty("padding-top", "0", "important");
      }
      tbl.querySelectorAll("td").forEach(function (td) {
        if (td.style) {
          td.style.setProperty("padding-top", "0", "important");
          td.style.setProperty("height", "auto", "important");
        }
      });
    });

    root.querySelectorAll("tr").forEach(function (tr) {
      if (tr.querySelector(".v-product-grid, .v-product, .v65-productDisplay")) return;
      var text = String(tr.textContent || "").replace(/\s+/g, "").trim();
      if (text) return;
      if (!tr.querySelector('img[src*="clear1x1"]')) return;
      if (tr.style) tr.style.setProperty("display", "none", "important");
    });
  }

  function findCategoryBreadcrumb(root) {
    var nodes = root.querySelectorAll("td > b, td b");
    var i;
    for (i = 0; i < nodes.length; i++) {
      var b = nodes[i];
      if (b.closest(".mc-category-meta, .v-product-grid, #mc-cat-luxe-comforts")) continue;
      var homeLink = b.querySelector('a[href="/"], a[href*="mccabestheaterandliving.com/"]');
      if (!homeLink) continue;
      if (!/home/i.test(homeLink.textContent || "")) continue;
      return b;
    }
    return null;
  }

  function findCategorySubcategoryCell(root) {
    var cells = root.querySelectorAll("td.colors_backgroundneutral");
    var i;
    for (i = 0; i < cells.length; i++) {
      if (cells[i].querySelector(".subcategory_link")) return cells[i];
    }
    return null;
  }

  function findCategoryMetaAnchor(root) {
    return (
      root.querySelector("#mc-cat-luxe-comforts") ||
      root.querySelector(".mc-cat-page") ||
      root.querySelector("form.search_results_section") ||
      root.querySelector(".v-product-grid") ||
      root.querySelector("table.v65-productDisplay")
    );
  }

  function organizeCategoryMeta(root) {
    root = root || document.getElementById("content_area");
    if (!root) return false;
    if (root.querySelector(".mc-category-meta")) return false;

    var anchor = findCategoryMetaAnchor(root);
    if (!anchor || !anchor.parentNode) return false;

    var crumb = findCategoryBreadcrumb(root);
    var subCell = findCategorySubcategoryCell(root);
    if (!crumb && !subCell) return false;

    var meta = document.createElement("div");
    meta.className = "mc-category-meta";

    if (crumb) {
      var crumbWrap = document.createElement("div");
      crumbWrap.className = "mc-category-meta__breadcrumb";
      crumbWrap.appendChild(crumb);
      meta.appendChild(crumbWrap);
    }

    if (subCell) {
      var subWrap = document.createElement("div");
      subWrap.className = "mc-category-meta__subcats";
      var links = subCell.querySelectorAll(".subcategory_link");
      var j;
      for (j = 0; j < links.length; j++) {
        subWrap.appendChild(links[j]);
      }
      if (subWrap.childNodes.length) meta.appendChild(subWrap);
      if (!subCell.textContent.replace(/\s+/g, "").length && subCell.parentNode) {
        try {
          subCell.parentNode.removeChild(subCell);
        } catch (eSub) {}
      }
    }

    anchor.parentNode.insertBefore(meta, anchor);
    pruneLegacyCategoryChromeBeforeHero(anchor);
    return true;
  }

  function pruneLegacyCategoryChromeBeforeHero(hero) {
    if (!hero || !hero.parentNode) return;
    var parent = hero.parentNode;
    var node = hero.previousElementSibling;
    var guard = 0;
    while (node && guard < 12) {
      guard += 1;
      if (node.classList && node.classList.contains("mc-category-meta")) {
        node = node.previousElementSibling;
        continue;
      }
      if (node.tagName === "TABLE") {
        var text = String(node.textContent || "").replace(/\s+/g, "").trim();
        var hasLinks =
          node.querySelector("td > b, .subcategory_link, a[href*='-p/'], .v-product-grid");
        if (!hasLinks && text.length < 16) {
          var remove = node;
          node = node.previousElementSibling;
          try {
            remove.parentNode.removeChild(remove);
          } catch (ePrune) {}
          continue;
        }
      }
      break;
    }

    parent.querySelectorAll("table").forEach(function (tbl) {
      if (tbl === hero || tbl.contains(hero)) return;
      if (!(tbl.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      if (tbl.querySelector(".subcategory_link, td > b, .v-product-grid, form.search_results_section")) {
        return;
      }
      var t = String(tbl.textContent || "").replace(/\s+/g, "").trim();
      if (t.length < 16) {
        try {
          tbl.parentNode.removeChild(tbl);
        } catch (eTbl) {}
      }
    });
  }

  function injectLuxeComfortsPlpGapCss() {
    if (document.getElementById("mc-luxe-plp-gap-css")) return;
    var s = document.createElement("style");
    s.id = "mc-luxe-plp-gap-css";
    s.textContent =
      "#mc-cat-luxe-comforts details.mc-cat-editorial-toggle:not([open])>.mc-cat-editorial-body{display:none!important;height:0!important;overflow:hidden!important;padding:0!important;margin:0!important;visibility:hidden!important}" +
      "html.category form.search_results_section aside.vol-list-grid,html[data-mc-category-plp='1'] form.search_results_section aside.vol-list-grid{display:none!important;height:0!important;overflow:hidden!important;visibility:hidden!important}" +
      "html.category:has(#mc-cat-luxe-comforts) .mc-seo-footer,html[data-mc-category-plp='1']:has(#mc-cat-luxe-comforts) .mc-seo-footer{display:none!important;height:0!important;overflow:hidden!important}";
    (document.head || document.documentElement).appendChild(s);
  }

  function syncLuxeComfortsEditorialToggle(det) {
    if (!det) return;
    var body = det.querySelector(":scope > .mc-cat-editorial-body");
    if (!body) return;
    if (det.open) {
      body.style.removeProperty("display");
      body.style.removeProperty("visibility");
      body.style.removeProperty("height");
    } else {
      body.style.setProperty("display", "none", "important");
      body.style.setProperty("visibility", "hidden", "important");
      body.style.setProperty("height", "0", "important");
      body.style.setProperty("overflow", "hidden", "important");
    }
  }

  function repairLuxeComfortsListingChrome(root) {
    root = root || document.getElementById("content_area");
    if (!root || !root.querySelector("#mc-cat-luxe-comforts")) return false;

    injectLuxeComfortsPlpGapCss();

    var changed = false;

    root.querySelectorAll("form.search_results_section aside.vol-list-grid").forEach(function (aside) {
      if (aside.parentNode) {
        aside.parentNode.removeChild(aside);
        changed = true;
      }
    });

    root.querySelectorAll(".mc-seo-footer").forEach(function (footer) {
      footer.style.setProperty("display", "none", "important");
      footer.setAttribute("data-mc-luxe-hidden", "1");
      changed = true;
    });

    var det = root.querySelector("#mc-cat-luxe-comforts details.mc-cat-editorial-toggle");
    if (det) {
      if (!det.dataset.mcEditorialBound) {
        det.dataset.mcEditorialBound = "1";
        det.addEventListener("toggle", function () {
          syncLuxeComfortsEditorialToggle(det);
        });
      }
      syncLuxeComfortsEditorialToggle(det);
      changed = true;
    }

    root.querySelectorAll("form.search_results_section td[rowspan]").forEach(function (td) {
      if (td.getAttribute("rowspan") !== "1") {
        td.removeAttribute("rowspan");
        changed = true;
      }
    });

    root.querySelectorAll("form.search_results_section > table").forEach(function (tbl) {
      if (tbl.style) {
        tbl.style.setProperty("margin-top", "0", "important");
        tbl.style.setProperty("margin-bottom", "8px", "important");
      }
    });

    return changed;
  }

  function tagCategoryFooterCopy(root) {
    root = root || document.getElementById("content_area") || document;
    root.querySelectorAll(".mc-seo-footer p").forEach(function (p) {
      if (!p.classList.contains("mc-category-footer-copy")) {
        p.classList.add("mc-category-footer-copy");
      }
    });
  }

  function tagProductGridAnchor(grid) {
    if (!grid) return grid;
    if (!grid.id) grid.id = "mc-products-start";
    else if (grid.id !== "mc-products-start") {
      grid.setAttribute("data-mc-original-id", grid.id);
      grid.id = "mc-products-start";
    }
    return grid;
  }

  /** Rebaked categories sometimes lose div.v-product-grid and fall back to Grid_Single table rows. */
  function convertLegacyGridSingleToProductGrid() {
    var root = document.getElementById("content_area");
    if (!root) return false;

    var table = findLegacyGridSingleProductTable(root);
    var expected = 0;
    if (table) {
      expected = (table.innerHTML.match(/Grid_Single_Divider_Horiz/gi) || []).length;
      if (!expected) {
        expected = (table.innerHTML.match(/VCompare\s*\(/gi) || []).length;
      }
    }

    var have = countGridProducts(root);
    if (!table) {
      if (have > 0) global.__MC_LEGACY_GRID_CONVERTED__ = true;
      return false;
    }
    if (have >= expected && expected > 0) {
      global.__MC_LEGACY_GRID_CONVERTED__ = true;
      injectLegacyPlpLayoutFixCss();
      collapsePlpGridGap(root);
      tagProductGridAnchor(root.querySelector(".v-product-grid"));
      return false;
    }
    if (global.__MC_LEGACY_GRID_CONVERTED__ && have > 0 && expected > 0 && have >= expected) {
      return false;
    }

    var blocks = splitGridSingleBlocks(table);
    if (!blocks.length) return false;

    injectVolusionProductGridStyle();

    var grid = document.createElement("div");
    grid.className = "v-product-grid";

    blocks.forEach(function (blockRows) {
      var card = document.createElement("div");
      card.className = "v-product";

      var imgA = findLegacyImageLink(blockRows);
      if (imgA) {
        var newImgA = imgA.cloneNode(true);
        newImgA.className = (newImgA.className + " v-product__img").trim();
        card.appendChild(newImgA);
      }

      var titleA = findLegacyTitleLink(blockRows);
      if (titleA) {
        var newTitle = titleA.cloneNode(true);
        newTitle.className = (newTitle.className + " v-product__title").trim();
        card.appendChild(newTitle);
      }

      var priceHtml = extractLegacyPriceHtml(blockRows);
      if (priceHtml) {
        var priceDiv = document.createElement("div");
        priceDiv.innerHTML = priceHtml;
        card.appendChild(priceDiv);
      }

      var vScript = findLegacyVCompareScript(blockRows);
      if (vScript) card.appendChild(vScript.cloneNode(true));

      if (card.childNodes.length) grid.appendChild(card);
    });

    var made = grid.querySelectorAll(".v-product").length;
    if (!made) return false;

    tagProductGridAnchor(grid);
    table.parentNode.replaceChild(grid, table);
    unwrapProductGridShell(grid);
    injectLegacyPlpLayoutFixCss();
    collapsePlpGridGap(root);
    global.__MC_LEGACY_GRID_CONVERTED__ = true;
    return true;
  }

  function countGridProducts(root) {
    return root.querySelectorAll(".v-product-grid .v-product").length;
  }

  function photoUrlFromAnySrc(src) {
    var m = String(src || "").match(/\/vspfiles\/photos\/([^?#]+)/i);
    if (!m) return null;
    return sameOriginPhotoUrl(m[1]) + "?v=" + VERSION;
  }

  function normalizePhotoSrc(src) {
    return photoUrlFromAnySrc(src) || String(src || "");
  }

  /** CDN may cache 404s for baked ?v-cache= URLs even after photos exist on SFTP. */
  function fixStalePhotoUrls(root) {
    root = root || document.getElementById("content_area") || document;
    root.querySelectorAll("img[src]").forEach(function (img) {
      var src = img.getAttribute("src") || img.src || "";
      if (/nophoto\.gif/i.test(src)) return;
      var normalized = photoUrlFromAnySrc(src);
      if (!normalized) return;
      if (
        normalized === src ||
        (!/v-cache=/i.test(src) &&
          !/volusion\.store/i.test(src) &&
          /^\/v\/vspfiles\/photos\//i.test(src))
      ) {
        return;
      }
      img.setAttribute("src", normalized);
      img.removeAttribute("data-mc-scale-done");
      img.classList.remove("mc-plp-img-fit", "mc-plp-img-sized");
    });
  }

  function applyNoPhotoSwap(img, sku) {
    if (!img || !sku) return;
    var photoCode = resolveTmhMatPhotoCode(sku);
    var file = photoCode + "-1.jpg";
    var probe = new Image();
    probe.onload = function () {
      if (probe.naturalWidth < 80) return;
      img.src = sameOriginPhotoUrl(file) + "?v=" + VERSION;
      img.removeAttribute("data-mc-scale-done");
      img.classList.remove("mc-plp-img-fit", "mc-plp-img-sized");
      var parent = thumbBox(img);
      if (parent) {
        parent.classList.add("mc-plp-image-box");
        clearClippingStyles(img, parent);
      }
      if (img.complete && img.naturalWidth) {
        if (isPreNormalizedPhoto(img)) {
          applyPreNormalizedPhoto(img, parent);
        } else {
          applyNormalizedImage(img, parent, null);
        }
      } else {
        img.addEventListener(
          "load",
          function () {
            if (isPreNormalizedPhoto(img)) {
              applyPreNormalizedPhoto(img, parent);
            } else {
              applyNormalizedImage(img, parent, null);
            }
          },
          { once: true }
        );
      }
    };
    probe.onerror = function () {};
    probe.src = sameOriginPhotoUrl(file) + "?mc-nophoto-probe=" + Date.now();
  }

  function skuFromProductTitle(title) {
    var m = String(title || "").match(/,\s*([^,"]+)\s*$/);
    return m ? String(m[1]).trim() : "";
  }

  /** Travel mats use TMH-TRV-* on Volusion; repo photos may be TMH-MAT-* stems. */
  var TMH_TRV_PHOTO_ALIASES = {
    "TMH-TRV-AMETHYST-GEM-MAT": "TMH-MAT-AMETHYST-GEM-TRAVEL-MAT",
    "TMH-TRV-AMETHYST-TABLE-MAT": "TMH-MAT-AMETHYST-TABLE-TRAVEL-MAT",
    "TMH-TRV-BLUE-MAT": "TMH-MAT-BLUE-MAT",
    "TMH-TRV-ELEC-BLU-GARDEN": "TMH-MAT-ELEC-BLU-GARDEN",
    "TMH-TRV-ELEC-BLU-TRELLIS": "TMH-MAT-ELEC-BLU-TRELLIS",
    "TMH-TRV-EMERALD-GEM-MAT": "TMH-MAT-EMERALD-GEM-MAT",
    "TMH-TRV-EMERALD-TABLE-MAT": "TMH-MAT-EMERALD-TABLE-MAT",
    "TMH-TRV-LILAC-GARDEN-MAT": "TMH-MAT-LILAC-GARDEN-MAT",
    "TMH-TRV-LILAC-TRELLIS-MAT": "TMH-MAT-LILAC-TRELLIS-MAT",
    "TMH-TRV-PLUM-GARDEN-MAT": "TMH-MAT-PLUM-GARDEN-MAT",
    "TMH-TRV-PLUM-TRELLIS-MAT": "TMH-MAT-PLUM-TRELLIS-MAT",
    "TMH-TRV-PURP-RED-GRN": "TMH-MAT-DECO-OLIVE-AND-RED-MAT",
    "TMH-TRV-RUBY-GEM-MAT": "TMH-MAT-RUBY-GEM-MAT",
    "TMH-TRV-RUBY-TABLE-MAT": "TMH-MAT-RUBY-TABLE-MAT",
    "TMH-TRV-SAPPHIRE-GEM-MAT": "TMH-MAT-SAPPHIRE-GEM-MAT",
    "TMH-TRV-SAPPHIRE-TABLE-MAT": "TMH-MAT-SAPPHIRE-TABLE-MAT",
    "TMH-TRV-TEAL-GARDEN-MAT": "TMH-MAT-TEAL-GARDEN-MAT",
    "TMH-TRV-TEAL-TRELLIS-MAT": "TMH-MAT-TEAL-TRELLIS-MAT",
  };

  function resolveTmhMatPhotoCode(sku) {
    var code = String(sku || "").trim().toUpperCase();
    if (!code) return code;
    if (TMH_TRV_PHOTO_ALIASES[code]) return TMH_TRV_PHOTO_ALIASES[code];
    return code;
  }

  function fixTmhMatPlpThumbnails(root) {
    root = root || document.getElementById("content_area") || document;
    root.querySelectorAll('img[src*="/vspfiles/photos/TMH-MAT-"]').forEach(function (img) {
      var src = String(img.getAttribute("src") || img.src || "");
      if (!/-2T\.(jpg|jpeg|png|webp)/i.test(src)) return;
      img.setAttribute("src", src.replace(/-2T\.(jpg|jpeg|png|webp)/i, "-1.$1"));
      img.removeAttribute("data-mc-scale-done");
      img.classList.remove("mc-plp-img-fit", "mc-plp-img-sized");
    });
    root.querySelectorAll(".v-product, td a.productnamecolor, td a.colors_productname").forEach(function (node) {
      var title = String(
        (node.getAttribute && (node.getAttribute("title") || node.textContent)) || ""
      );
      if (!/TMH-MAT-|TMH-TRV-/i.test(title)) return;
      var m = title.match(/,\s*(TMH-(?:MAT|TRV)-[A-Z0-9-]+)\s*$/i);
      if (!m) return;
      var code = resolveTmhMatPhotoCode(m[1]);
      var block = node.closest ? node.closest(".v-product, tr, td") : node;
      if (!block) return;
      var img =
        (block.querySelector && block.querySelector("a.v-product__img img, .v-product__img img, img")) ||
        null;
      if (!img) return;
      img.setAttribute("src", sameOriginPhotoUrl(code + "-1.jpg") + "?v=" + VERSION);
      img.removeAttribute("data-mc-scale-done");
      img.classList.remove("mc-plp-img-fit", "mc-plp-img-sized");
    });
  }

  /** Volusion PLP often bakes NoPhoto.gif even when {SKU}-1.jpg exists on SFTP — probe and swap. */
  function fixNoPhotoThumbnails() {
    if (isCloseoutSalePlp()) return;
    var root = document.getElementById("content_area");
    if (!root) return;

    root.querySelectorAll(".v-product").forEach(function (block) {
      var titleEl =
        block.querySelector("a.v-product__title") ||
        block.querySelector("a.productnamecolor, a.colors_productname");
      var sku = skuFromProductTitle(
        titleEl && (titleEl.getAttribute("title") || titleEl.textContent)
      );
      if (!sku || !/^[0-9A-Za-z][0-9A-Za-z-]*$/.test(sku)) return;

      var img =
        block.querySelector("a.v-product__img img") ||
        block.querySelector(".v-product__img img") ||
        block.querySelector("img");
      if (!img || !isNoPhotoPlaceholder(img.currentSrc || img.src)) return;
      applyNoPhotoSwap(img, sku);
    });

    root
      .querySelectorAll(
        "#v65-product-related a.productnamecolorsmall, #v65-product-related a.productnamecolor, " +
          "#related_products_content a.productnamecolorsmall, #related_products_content a.productnamecolor, " +
          ".mc-related-plp-card__title a"
      )
      .forEach(function (titleEl) {
        var sku = skuFromProductTitle(
          titleEl && (titleEl.getAttribute("title") || titleEl.textContent)
        );
        if (!sku || !/^[0-9A-Za-z][0-9A-Za-z-]*$/.test(sku)) return;
        var card =
          (titleEl.closest && titleEl.closest(".mc-related-plp-card")) ||
          titleEl.closest("td") ||
          titleEl.parentElement;
        if (!card || !card.querySelector) return;
        var img = card.querySelector("img");
        if (!img || !isNoPhotoPlaceholder(img.currentSrc || img.src)) return;
        applyNoPhotoSwap(img, sku);
      });

    var legacyTable = root.querySelector("table.v65-productDisplay");
    if (
      legacyTable &&
      /Grid_Single_Divider/i.test(legacyTable.innerHTML || "") &&
      !legacyTable.querySelector(".v-product-grid")
    ) {
      splitGridSingleBlocks(legacyTable).forEach(function (blockRows) {
        var sku = legacySkuFromRows(blockRows);
        if (!sku || !/^[0-9A-Za-z][0-9A-Za-z-]*$/.test(sku)) return;
        var img = null;
        var i;
        for (i = 0; i < blockRows.length; i++) {
          var cand = blockRows[i].querySelector("td[rowspan] img, img");
          if (cand && isNoPhotoPlaceholder(cand.currentSrc || cand.src)) {
            img = cand;
            break;
          }
        }
        if (!img) return;
        applyNoPhotoSwap(img, sku);
      });
    }
  }

  function thumbBox(img) {
    if (!img || !img.closest) return img ? img.parentElement : null;
    return (
      img.closest("a.v-product__img, .v-product__img") ||
      img.parentElement
    );
  }

  function isBackgroundPixel(r, g, b, a) {
    if (a < 10) return true;
    if (r > 245 && g > 245 && b > 245) return true;
    if (r > 235 && g > 235 && b > 235) return true;
    return false;
  }

  function measureProbe(probe, cb) {
    try {
      var nw = probe.naturalWidth;
      var nh = probe.naturalHeight;
      if (!nw || !nh) {
        cb(null);
        return;
      }
      var maxSide = BOUNDS_SAMPLE;
      var w = nw >= nh ? maxSide : Math.round((maxSide * nw) / nh);
      var h = nh >= nw ? maxSide : Math.round((maxSide * nh) / nw);
      if (w < 1) w = 1;
      if (h < 1) h = 1;

      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(probe, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;

      var minX = w;
      var minY = h;
      var maxX = 0;
      var maxY = 0;
      var found = false;
      var x;
      var y;
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          if (isBackgroundPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (!found || minX >= maxX || minY >= maxY) {
        cb(null);
        return;
      }

      var sx = nw / w;
      var sy = nh / h;
      cb({
        width: (maxX - minX + 1) * sx,
        height: (maxY - minY + 1) * sy,
      });
    } catch (err) {
      cb(null);
    }
  }

  function isPreNormalizedPhoto(img) {
    return (
      img &&
      img.naturalWidth === NORMALIZED_W &&
      img.naturalHeight === NORMALIZED_H
    );
  }

  function targetVisibleWidth(parent) {
    var boxW = parent && parent.clientWidth ? parent.clientWidth : 280;
    return Math.min(360, Math.max(TARGET_VISIBLE_W, boxW - 20));
  }

  function getVisibleBounds(img, cb) {
    var file = photoFilename(img.currentSrc || img.src);
    withBoundsMap(function (map) {
      if (file && map[file] && map[file].visibleW > 0) {
        var b = map[file];
        var nw = img.naturalWidth || b.nw;
        var nh = img.naturalHeight || b.nh;
        if (b.nw > 0 && b.nh > 0 && nw > 0 && nh > 0) {
          var sx = nw / b.nw;
          var sy = nh / b.nh;
          cb({ width: b.visibleW * sx, height: b.visibleH * sy });
          return;
        }
        cb({ width: b.visibleW, height: b.visibleH });
        return;
      }
      if (!file) {
        cb(null);
        return;
      }
      var probe = new Image();
      probe.onload = function () {
        measureProbe(probe, cb);
      };
      probe.onerror = function () {
        cb(null);
      };
      probe.src = sameOriginPhotoUrl(file) + "?mc-b=" + Date.now();
    });
  }

  function clearClippingStyles(img, parent) {
    parent.classList.remove("mc-plp-thumb-mat");
    parent.style.removeProperty("max-height");
    parent.style.removeProperty("min-height");
    parent.style.removeProperty("clip-path");
    parent.style.setProperty("overflow", "visible", "important");
    parent.style.setProperty("background", "transparent", "important");
    parent.style.setProperty("background-color", "transparent", "important");

    img.style.removeProperty("transform");
    img.removeAttribute("data-scale");
    img.removeAttribute("data-mc-scale-done");
    img.style.removeProperty("clip-path");
    img.style.removeProperty("max-height");
    img.style.removeProperty("min-height");
    img.style.setProperty("transform", "none", "important");
    img.style.setProperty("border", "none", "important");
    img.style.setProperty("outline", "none", "important");
    img.style.setProperty("box-shadow", "none", "important");
    img.style.setProperty("background", "transparent", "important");
    img.removeAttribute("border");
  }

  function applyImageBoxLayout(parent) {
    parent.classList.add("mc-plp-image-box");
    parent.style.setProperty("height", BOX_HEIGHT + "px", "important");
    parent.style.setProperty("overflow", "visible", "important");
    parent.style.setProperty("display", "flex", "important");
    parent.style.setProperty("align-items", "center", "important");
    parent.style.setProperty("justify-content", "center", "important");
    parent.style.setProperty("width", "100%", "important");
    parent.style.setProperty("background", "#ffffff", "important");
    parent.style.setProperty("background-color", "#ffffff", "important");
  }

  /* Image element always matches the wrapper box exactly; object-fit: contain scales the photo inside. */
  function applyWrapperFill(img, parent, extraClass) {
    applyImageBoxLayout(parent);
    clearClippingStyles(img, parent);
    img.classList.add(extraClass);
    img.style.setProperty("width", "100%", "important");
    img.style.setProperty("height", "100%", "important");
    img.style.setProperty("max-width", "none", "important");
    img.style.setProperty("max-height", "none", "important");
    img.style.setProperty("object-fit", "contain", "important");
    img.style.setProperty("object-position", "center center", "important");
    img.style.setProperty("transform", "none", "important");
    img.style.setProperty("display", "block", "important");
  }

  function applyPreNormalizedPhoto(img, parent) {
    applyWrapperFill(img, parent, "mc-plp-img-fit");
  }

  function applyNormalizedImage(img, parent, bounds) {
    applyWrapperFill(img, parent, "mc-plp-img-sized");
  }

  function normalizePLPImages() {
    if (!isCategoryPlp() || isCloseoutSalePlp()) return;

    var root = document.getElementById("content_area");
    if (!root) return;

    root.querySelectorAll("img").forEach(function (img) {
      if (!isProductPhoto(img)) return;
      if (img.closest("#v65-product-related, #related_products_content, .mc-related-plp-grid")) return;

      var parent = thumbBox(img);
      if (!parent) return;

      parent.classList.add("mc-plp-image-box");
      clearClippingStyles(img, parent);

      function apply() {
        if (!img.naturalWidth) return;
        if (isPreNormalizedPhoto(img)) {
          applyPreNormalizedPhoto(img, parent);
          return;
        }
        applyNormalizedImage(img, parent, null);
      }

      if (img.complete && img.naturalWidth) apply();
      else img.addEventListener("load", apply, { once: true });
    });
  }

  function hideHero() {
    if (isHome()) return;
    document.documentElement.classList.remove("mc-allow-home-hero");
    if (document.body) document.body.classList.remove("is-home");
    document
      .querySelectorAll(
        "#if_homepage,#slideshow-container,#slideshow-container .mc-hero-video,.mc-hero-video,video.mc-hero-video-el"
      )
      .forEach(function (n) {
        n.style.setProperty("display", "none", "important");
        n.style.setProperty("height", "0", "important");
        n.style.setProperty("min-height", "0", "important");
        n.style.setProperty("opacity", "0", "important");
        n.style.setProperty("overflow", "hidden", "important");
      });
  }

  function run() {
    if (!isCategoryPlp()) return;
    markCategory();
    repairCategoryPageShell();
    injectCriticalThumbCss();
    removeLegacyCategoryBars();
    organizeCategoryMeta();
    repairCartFloatIcon();
    repairLuxeComfortsListingChrome();
    convertLegacyGridSingleToProductGrid();
    fixStalePhotoUrls();
    fixNoPhotoThumbnails();
    fixTmhMatPlpThumbnails();
    normalizePLPImages();
    injectLegacyPlpLayoutFixCss();
    collapsePlpGridGap(document.getElementById("content_area") || document);
    tagCategoryFooterCopy();
    repairCategoryPageShell();
    hideHero();
    if (!global.__MC_PLP_NORM_RETRIES__) {
      global.__MC_PLP_NORM_RETRIES__ = 1;
      [200, 800, 2500, 5000].forEach(function (ms) {
        global.setTimeout(function () {
          repairCategoryPageShell();
          organizeCategoryMeta();
          repairLuxeComfortsListingChrome();
          convertLegacyGridSingleToProductGrid();
          fixStalePhotoUrls();
          fixNoPhotoThumbnails();
          fixTmhMatPlpThumbnails();
          normalizePLPImages();
          injectLegacyPlpLayoutFixCss();
          collapsePlpGridGap(document.getElementById("content_area") || document);
          tagCategoryFooterCopy();
          repairCategoryPageShell();
        }, ms);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", run);
  global.addEventListener("load", run);
  global.addEventListener("resize", normalizePLPImages);
  if (isCategoryPlp()) {
    markCategory();
    run();
  }

  if (typeof MutationObserver !== "undefined") {
    var scheduled = false;
    var mo = new MutationObserver(function (mutations) {
      var needsBar = false;
      var needsThumb = false;
      var i;
      for (i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "childList") {
          needsBar = true;
          needsThumb = true;
          break;
        }
      }
      if (!needsBar && !needsThumb) return;
      if (scheduled) return;
      scheduled = true;
      global.requestAnimationFrame(function () {
        scheduled = false;
        if (!isCategoryPlp()) return;
        if (needsBar) removeLegacyCategoryBars();
        if (needsThumb) {
          organizeCategoryMeta();
          repairLuxeComfortsListingChrome();
          convertLegacyGridSingleToProductGrid();
          fixStalePhotoUrls();
          fixNoPhotoThumbnails();
          normalizePLPImages();
          injectLegacyPlpLayoutFixCss();
          collapsePlpGridGap(document.getElementById("content_area") || document);
          tagCategoryFooterCopy();
          repairCategoryPageShell();
        }
      });
    });
    var root = document.getElementById("content_area") || document.body;
    if (root) {
      mo.observe(root, { childList: true, subtree: true });
    }
  }

  global.mcPlpEnforcerRun = run;

  var PRICE_ZERO_CENT_SELECTOR =
    ".product_list_price,.product_sale_price,.product_saleprice,.product_productprice,.product_price," +
    ".v-product__price,.mc-member-grid-price,.mc-pdp-stack-retail-amt,.mc-pdp-top-price-value,.mtl-top-price__amount," +
    "#priceWithOptions,#priceWithOptionsNoTax,.colors_productprice,.pricecolor,.mc-member-price-caption," +
    ".mc-pdp-member-line__amount,.v65-product-price,.mc-member-grid-price__amount";

  function stripZeroCentTextNodes(scope) {
    if (!scope || typeof global.document.createTreeWalker !== "function") return;
    var walker = global.document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.indexOf(".00") === -1) {
          return NodeFilter.FILTER_REJECT;
        }
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "OPTION") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = walker.nextNode())) {
      var v = n.nodeValue;
      var nv = v.replace(/(\$\d[\d,]*)\.00(?!\d)/g, "$1");
      if (nv !== v) n.nodeValue = nv;
    }
  }

  function stripPriceZeroCentsLocal(root) {
    if (typeof global.mcStripPriceZeroCents === "function") {
      global.mcStripPriceZeroCents(root);
      return;
    }
    root = root || global.document.body;
    if (!root || !root.querySelectorAll) return;
    try {
      root.querySelectorAll(PRICE_ZERO_CENT_SELECTOR).forEach(function (el) {
        stripZeroCentTextNodes(el);
      });
    } catch (eStrip) {}
    // Category/search pages can render prices in containers not covered by the
    // selector list above. Sweep the content area so no $X.00 slips through.
    try {
      var area = global.document.getElementById("content_area") || root;
      stripZeroCentTextNodes(area);
    } catch (eSweep) {}
  }

  function runGlobalPriceDisplayFix() {
    stripPriceZeroCentsLocal();
  }

  global.document.addEventListener("DOMContentLoaded", runGlobalPriceDisplayFix);
  global.addEventListener("load", runGlobalPriceDisplayFix);
  [200, 800, 2500].forEach(function (ms) {
    global.setTimeout(runGlobalPriceDisplayFix, ms);
  });

  if (typeof MutationObserver !== "undefined") {
    var priceMoScheduled = false;
    var priceMo = new MutationObserver(function (mutations) {
      var i;
      for (i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "characterData" || mutations[i].type === "childList") {
          if (priceMoScheduled) return;
          priceMoScheduled = true;
          global.requestAnimationFrame(function () {
            priceMoScheduled = false;
            runGlobalPriceDisplayFix();
          });
          return;
        }
      }
    });
    var priceRoot = global.document.getElementById("content_area") || global.document.body;
    if (priceRoot) {
      priceMo.observe(priceRoot, { childList: true, subtree: true, characterData: true });
    }
  }

  var PDP_AUTH_WANT = "20260712pdp04";

  function isSaranoniPdpPage() {
    try {
      var path = String(global.location.pathname || "").toLowerCase();
      if (/\/product-p\/sar-/i.test(path)) return true;
      if (/productdetails\.asp/i.test(path) && /productcode=sar/i.test(String(global.location.search || ""))) {
        return true;
      }
      var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      var pc = String((pcEl && pcEl.value) || "").trim().toUpperCase();
      if (/^SAR/.test(pc)) return true;
      if (global.document.body && global.document.body.classList.contains("mc-saranoni-product")) return true;
    } catch (eSar) {}
    return false;
  }

  function loadPdpAuthCtaFix() {
    try {
      if (isSaranoniPdpPage()) return;
      var b = global.document.body;
      var onPdp =
        (b && b.classList.contains("productdetails")) ||
        !!global.document.getElementById("v65-product-parent");
      if (!onPdp) return;
      if (String(global.__MC_PDP_AUTH_CTA_FIX_VER__ || "") === PDP_AUTH_WANT) return;
      global.document
        .querySelectorAll('script[src*="mc-pdp-auth-cta-fix.js"]')
        .forEach(function (old) {
          try {
            old.remove();
          } catch (eRm) {}
        });
      delete global.__MC_PDP_AUTH_CTA_FIX_VER__;
      var s = global.document.createElement("script");
      s.src =
        "/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v=" +
        PDP_AUTH_WANT +
        "&mcrd=" +
        Date.now();
      s.async = false;
      (global.document.head || global.document.documentElement).appendChild(s);
    } catch (eLoad) {}
  }

  loadPdpAuthCtaFix();
  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", loadPdpAuthCtaFix);
  }
  global.addEventListener("load", loadPdpAuthCtaFix);
  [0, 400, 1500].forEach(function (ms) {
    global.setTimeout(loadPdpAuthCtaFix, ms);
  });

  /* MC_CAT142_BEDROOM_LANDING — inject Steve Silver bedroom PLP hero (template rebake lags). */
  (function cat142BedroomLanding(doc, win) {
    var FRAG_URL = "/v/vspfiles/category-landings/cat142-bedroom.html?v=20260620";
    var guard = "__MC_CAT142_BEDROOM__";

    function page1() {
      try {
        var path = String(win.location.pathname || "").toLowerCase();
        if (!/-s\/142\.html?$/i.test(path)) return false;
        var q = win.location.search || "";
        if (/(?:^|[?&])page=(?!1(?:&|$))[^&]+/i.test(q)) return false;
        var scripts = doc.querySelectorAll("#content_area script");
        var i;
        for (i = 0; i < scripts.length; i++) {
          var t = scripts[i].textContent || "";
          if (/SearchParams\s*=/.test(t) && /cat=142/i.test(t)) {
            if (/page=\d+/i.test(t) && !/page=1(?:&|'|"|\s|;|$)/i.test(t)) return false;
            break;
          }
        }
        var pageInp = doc.querySelector('input[title="Go to page"]');
        if (pageInp && String(pageInp.value || "1").trim() !== "1") return false;
        return true;
      } catch (eP1) {
        return false;
      }
    }

    function insert(html) {
      if (!html || doc.getElementById("mc-cat-bedroom")) return true;
      var form = doc.getElementById("MainForm");
      if (!form || !form.parentNode) return false;
      var mount = doc.createElement("div");
      mount.innerHTML = html;
      while (mount.firstChild) {
        form.parentNode.insertBefore(mount.firstChild, form);
      }
      return true;
    }

    var fetchStarted = false;
    function load() {
      if (!page1() || doc.getElementById("mc-cat-bedroom") || fetchStarted) return;
      fetchStarted = true;
      win
        .fetch(FRAG_URL, { credentials: "same-origin" })
        .then(function (res) {
          return res.ok ? res.text() : "";
        })
        .then(insert)
        .catch(function () {
          fetchStarted = false;
        });
    }

    function tryLoad() {
      if (!page1() || doc.getElementById("mc-cat-bedroom")) return;
      load();
      var tries = 0;
      var timer = win.setInterval(function () {
        tries += 1;
        if (doc.getElementById("mc-cat-bedroom") || !page1()) {
          win.clearInterval(timer);
          return;
        }
        if (!fetchStarted) load();
        if (tries > 50) win.clearInterval(timer);
      }, 100);
    }

    if (win[guard]) return;
    win[guard] = true;
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", tryLoad);
    } else {
      tryLoad();
    }
    win.addEventListener("load", tryLoad);
  })(global.document, global);

  global.document.addEventListener("DOMContentLoaded", repairCartFloatIcon);
  global.addEventListener("load", repairCartFloatIcon);
  [200, 1000, 3000].forEach(function (ms) {
    global.setTimeout(repairCartFloatIcon, ms);
  });
  repairCartFloatIcon();
})(window);

/* MC_CAT_CARDIFY_20260702 — appended module.
   Some categories (mahjong 202/203/204 etc.) use Volusion's name-row-first
   format: table.v65-productDisplay with separate rows [names, price/atc,
   images]. Restack each product column into image -> name -> price, like the
   photo-row-first categories (e.g. bean bags 103) already render. */
(function (global) {
  var d = global.document;

  function isCategoryListing() {
    try {
      if (d.body && (d.body.classList.contains("category") || d.body.classList.contains("is-category-or-listing-page"))) return true;
    } catch (e) {}
    return /-s\/\d+\.htm/i.test(global.location.pathname || "");
  }

  function productCells(row) {
    return Array.prototype.filter.call(row.cells || [], function (td) {
      return !td.classList.contains("v65-productColumn-divider") && !td.querySelector("img[src*='clear1x1']") || td.querySelector("a[href*='-p/'], img[src*='/photos/']");
    }).filter(function (td) {
      return !td.classList.contains("v65-productColumn-divider");
    });
  }

  function cardifyLegacyNameFirstTables() {
    if (!isCategoryListing()) return;
    d.querySelectorAll("#content_area table.v65-productDisplay").forEach(function (tbl) {
      if (tbl.getAttribute("data-mc-cardified") === "1") return;
      if (tbl.closest("#v65-product-related, #related_products_content, .mc-related-carousel")) return;
      var tbody = tbl.tBodies[0];
      if (!tbody) return;
      var rows = Array.prototype.slice.call(tbody.rows);
      var changed = false;
      var createdCards = [];
      var i;
      for (i = 0; i < rows.length; i++) {
        var nameRow = rows[i];
        if (!nameRow.querySelector("td.v65-productName a.productnamecolor")) continue;
        // name-first band = name row followed by price/atc row and image row
        var priceRow = rows[i + 1];
        var imageRow = rows[i + 2];
        if (!priceRow || !imageRow) continue;
        if (!imageRow.querySelector("a[href*='-p/'] img, img[src*='/photos/']")) continue;
        // band gates: next row must be a real price row (not another name row),
        // and every image cell must hold a product-linked image or the native
        // no-photo placeholder — otherwise this is category CONTENT, skip it.
        if (priceRow.querySelector("a.productnamecolor")) continue;
        if (!priceRow.querySelector(".product_productprice, .colors_productprice, [class*='productprice']")) continue;
        var nameCells = Array.prototype.filter.call(nameRow.cells, function (td) {
          return td.classList.contains("v65-productName") && td.querySelector("a.productnamecolor[href*='-p/']");
        });
        var priceCells = Array.prototype.filter.call(priceRow.cells, function (td) {
          return !td.classList.contains("v65-productColumn-divider") && !td.hasAttribute("rowspan");
        });
        var imageCells = Array.prototype.filter.call(imageRow.cells, function (td) {
          return !td.classList.contains("v65-productColumn-divider") && !td.hasAttribute("rowspan");
        });
        var allImageCellsProduct = imageCells.length > 0 && imageCells.every(function (td) {
          return td.querySelector("a[href*='-p/'] img") || /nos*photo|image coming soon/i.test(td.textContent || "");
        });
        if (!allImageCellsProduct) continue;
        if (!nameCells.length || nameCells.length !== imageCells.length) continue;
        var k;
        for (k = 0; k < nameCells.length; k++) {
          var card = d.createElement("div");
          card.className = "mc-cat-prodcard";
          var mediaWrap = d.createElement("div");
          mediaWrap.className = "mc-cat-prodcard__media";
          while (imageCells[k] && imageCells[k].firstChild) mediaWrap.appendChild(imageCells[k].firstChild);
          card.appendChild(mediaWrap);
          var nameWrap = d.createElement("div");
          nameWrap.className = "mc-cat-prodcard__name";
          while (nameCells[k].firstChild) nameWrap.appendChild(nameCells[k].firstChild);
          card.appendChild(nameWrap);
          var priceWrap = d.createElement("div");
          priceWrap.className = "mc-cat-prodcard__price";
          if (priceCells[k]) {
            while (priceCells[k].firstChild) priceWrap.appendChild(priceCells[k].firstChild);
          }
          card.appendChild(priceWrap);
          nameCells[k].appendChild(card);
          createdCards.push(card);
          nameCells[k].style.setProperty("vertical-align", "top", "important");
        }
        priceRow.style.setProperty("display", "none", "important");
        imageRow.style.setProperty("display", "none", "important");
        changed = true;
        i += 2;
      }
      if (changed) tbl.setAttribute("data-mc-cardified", "1");
      // Lift the cards out of the legacy table into a real grid — the table's
      // shared column tracks make band-to-band alignment impossible.
      if (createdCards.length) {
        var leftoverName = Array.prototype.some.call(tbl.querySelectorAll("a.productnamecolor"), function (a) {
          return !a.closest(".mc-cat-prodcard");
        });
        if (!leftoverName) {
          var grid = d.createElement("div");
          grid.className = "mc-cat-prodgrid";
          createdCards.forEach(function (cardEl) {
            grid.appendChild(cardEl);
          });
          try {
            tbl.parentNode.insertBefore(grid, tbl);
            tbl.style.setProperty("display", "none", "important");
          } catch (eLift) {}
        }
      }
    });
  }

  function ensureCardifyCss() {
    if (d.getElementById("mc-cat-prodcardify-css") || d.getElementById("mc-cat-prodcard-css")) return;
    var st = d.createElement("style");
    st.id = "mc-cat-prodcardify-css";
    st.textContent =
      ".mc-cat-prodgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px 18px;width:100%;margin:8px 0 24px;}" +
      "@media (max-width:767px){.mc-cat-prodgrid{grid-template-columns:repeat(2,1fr);gap:20px 10px;}}" +
      "@media (max-width:575px){.mc-cat-prodgrid{grid-template-columns:minmax(0,1fr)!important;gap:12px!important;}}" +
      ".mc-cat-prodcard{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:8px 6px 22px;min-width:0;}" +
      ".mc-cat-prodcard > *{position:static !important;float:none !important;}" +
      /* uniform square media stage regardless of source thumb size */
      ".mc-cat-prodcard__media{width:280px;max-width:280px;margin:0 auto;}" +
      ".mc-cat-prodcard__media img{width:100% !important;max-width:280px !important;aspect-ratio:1/1;object-fit:contain;height:auto !important;display:block;margin:0 auto;}" +
      ".mc-cat-prodcard__media a{display:block;width:100% !important;}" +
      ".mc-cat-prodcard__media h3{margin:0;font-size:20px;color:#999;}" +
      ".mc-cat-prodcard__media p{margin:0 0 6px;color:#aaa;font-size:13px;}" +
      ".mc-cat-prodcard__name{margin-bottom:-25px!important;}" +
      ".mc-cat-prodcard__name a.productnamecolor{display:block;margin-top:2px;font-size:15px;letter-spacing:.04em;text-decoration:none;" +
      "white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;}" +
      ".mc-cat-prodcard__price{margin-top:2px;}" +
      ".mc-cat-prodcard__price .product_productprice{font-size:17px;float:none !important;text-align:center !important;}" +
      ".mc-cat-prodcard__price img[src*='FreeShipping' i],.mc-cat-prodcard__price img[alt='Free Shipping' i]," +
      ".mc-plp-free-ship{display:block!important;margin:4px auto 0!important;line-height:0!important;height:auto!important;text-align:center!important;}" +
      ".mc-plp-free-ship img,.mc-cat-prodcard__price img[src*='FreeShipping' i],.v-product .mc-plp-free-ship img{" +
      "display:inline-block!important;max-height:22px!important;width:auto!important;height:auto!important;margin:0 auto!important;vertical-align:middle!important}" +
      ".mc-cat-prodcard br{display:none;}";
    (d.head || d.documentElement).appendChild(st);
  }

  function isMobileCategoryViewport() {
    try {
      return !!(global.matchMedia && global.matchMedia("(max-width: 991px)").matches);
    } catch (eMq) {
      return global.innerWidth <= 991;
    }
  }

  function isDividerCell(td) {
    if (!td) return true;
    if (td.hasAttribute("rowspan")) return true;
    if (td.classList && td.classList.contains("v65-productColumn-divider")) return true;
    var bg = String(td.getAttribute("background") || "");
    if (/Grid_Divider/i.test(bg)) return true;
    if (td.querySelector("img[src*='Grid_Divider'], img[src*='clear1x1.gif']") && !td.querySelector("a[href*='-p/'] img, img[src*='/photos/']")) {
      return true;
    }
    return false;
  }

  function isPhotoFirstProductTable(tbl) {
    if (!tbl || !tbl.rows || !tbl.rows.length) return false;
    var row = tbl.rows[0];
    var productTds = 0;
    var hasDivider = false;
    Array.prototype.forEach.call(row.cells || [], function (td) {
      if (isDividerCell(td)) {
        hasDivider = true;
        return;
      }
      if (td.querySelector("a[href*='-p/'] img, img[src*='/photos/']")) productTds++;
    });
    return hasDivider && productTds >= 2;
  }

  /** Bean Bags (103) etc.: photo-row-first table with width=33% columns + vertical
      dividers. On mobile only, restack EVERY band into one .v-product-grid so
      all products show (not just the first row of 3). Desktop table left alone. */
  function cardifyLegacyPhotoFirstTables() {
    if (!isCategoryListing()) return;
    if (!isMobileCategoryViewport()) return;
    d.querySelectorAll("#content_area table.v65-productDisplay").forEach(function (tbl) {
      if (tbl.getAttribute("data-mc-photo-cardified") === "1") return;
      if (tbl.closest("#v65-product-related, #related_products_content, .mc-related-carousel")) return;
      if (!isPhotoFirstProductTable(tbl)) return;
      var tbody = tbl.tBodies[0];
      if (!tbody || tbody.rows.length < 2) return;

      function rowPhotoCells(row) {
        var cells = [];
        Array.prototype.forEach.call(row.cells || [], function (td) {
          if (isDividerCell(td)) return;
          if (td.querySelector("a[href*='-p/'] img, img[src*='/photos/']")) cells.push(td);
        });
        return cells;
      }

      function isImageBandRow(row) {
        return rowPhotoCells(row).length >= 1 && !!row.querySelector("a[href*='-p/'] img, img[src*='/photos/']");
      }

      function buildCard(imgTd, detailRows, colIdx) {
        var card = d.createElement("div");
        card.className = "v-product";
        var imgLink = imgTd.querySelector("a[href*='-p/']");
        if (imgLink) {
          var a = imgLink.cloneNode(true);
          a.className = String(a.className || "").replace(/\bv-product__img\b/g, "").trim();
          a.className = (a.className ? a.className + " " : "") + "v-product__img";
          card.appendChild(a);
        } else {
          var img = imgTd.querySelector("img[src*='/photos/']");
          if (img) card.appendChild(img.cloneNode(true));
        }
        detailRows.forEach(function (drow) {
          var cells = Array.prototype.filter.call(drow.cells || [], function (td) {
            return !isDividerCell(td);
          });
          var cell = cells[colIdx];
          if (!cell) return;
          var nameA = cell.querySelector("a.productnamecolor[href*='-p/']");
          if (!nameA) {
            Array.prototype.forEach.call(cell.querySelectorAll("a[href*='-p/']"), function (lnk) {
              if (!nameA && !lnk.querySelector("img")) nameA = lnk;
            });
          }
          if (nameA) {
            var title = nameA.cloneNode(true);
            title.className = String(title.className || "").replace(/\bv-product__title\b/g, "").trim();
            title.className = (title.className ? title.className + " " : "") + "v-product__title productnamecolor";
            card.appendChild(title);
          }
          var price = cell.querySelector(
            ".product_productprice, .product_price, font.product_productprice, .colors_productprice, .product_sale_price, font.product_sale_price"
          );
          if (price) {
            var priceWrap = d.createElement("div");
            priceWrap.className = "v-product__price";
            priceWrap.appendChild(price.cloneNode(true));
            card.appendChild(priceWrap);
          } else if (!nameA) {
            var text = String(cell.textContent || "").replace(/\s+/g, " ").trim();
            if (text && /\$/.test(text)) {
              var parts = text.split(/\s*:\s*(?=\$)/);
              if (parts.length >= 2) {
                var nameEl = d.createElement("div");
                nameEl.className = "v-product__title productnamecolor";
                nameEl.textContent = parts[0];
                card.appendChild(nameEl);
                var priceEl = d.createElement("div");
                priceEl.className = "v-product__price product_productprice";
                priceEl.textContent = parts.slice(1).join(" : ");
                card.appendChild(priceEl);
              }
            }
          } else if (/\$/.test(String(cell.textContent || ""))) {
            var leftover = String(cell.textContent || "")
              .replace(String(nameA.textContent || ""), "")
              .replace(/\s+/g, " ")
              .replace(/^[\s:]+/, "")
              .trim();
            if (leftover && /\$/.test(leftover)) {
              var priceOnly = d.createElement("div");
              priceOnly.className = "v-product__price product_productprice";
              priceOnly.textContent = leftover;
              card.appendChild(priceOnly);
            }
          }
          /* Keep Volusion free-shipping icon under price (cardify used to drop it). */
          if (!card.querySelector(".mc-plp-free-ship, img[src*='FreeShipping' i]")) {
            var freeShipImg = cell.querySelector(
              "img[src*='FreeShipping' i], img[src*='freeshipping' i], img[alt='Free Shipping' i], .vCSS_img_icon_free_shipping, .vol-free-shipping-icon"
            );
            if (freeShipImg) {
              var fsWrap = d.createElement("div");
              fsWrap.className = "mc-plp-free-ship";
              var fsLink = freeShipImg.closest ? freeShipImg.closest("a") : null;
              var fsNode = (fsLink || freeShipImg).cloneNode(true);
              var fsImg = fsNode.tagName === "IMG" ? fsNode : fsNode.querySelector("img");
              if (fsImg) {
                var fsSrc = String(fsImg.getAttribute("src") || "");
                /* Small.gif is a tiny box glyph that looks like a broken symbol;
                   use the full "FREE SHIPPING" badge instead. */
                if (/Icon_FreeShipping_Small\.gif/i.test(fsSrc)) {
                  fsImg.setAttribute(
                    "src",
                    fsSrc.replace(/Icon_FreeShipping_Small\.gif/i, "Icon_FreeShipping.gif")
                  );
                }
                fsImg.style.maxHeight = "22px";
                fsImg.style.width = "auto";
              }
              fsWrap.appendChild(fsNode);
              card.appendChild(fsWrap);
            }
          }
          if (/more sizes|colors available/i.test(String(cell.textContent || "")) && !card.querySelector(".mc-plp-bean-subline")) {
            var subEl = d.createElement("div");
            subEl.className = "mc-plp-bean-subline";
            subEl.textContent = "More sizes and colors available";
            card.appendChild(subEl);
          }
        });
        return card.childNodes.length ? card : null;
      }

      var grid = d.createElement("div");
      grid.className = "v-product-grid";
      grid.setAttribute("data-mc-photo-cardified-grid", "1");
      var rows = Array.prototype.slice.call(tbody.rows);
      var i = 0;
      while (i < rows.length) {
        if (!isImageBandRow(rows[i])) {
          i++;
          continue;
        }
        var imgCells = rowPhotoCells(rows[i]);
        if (!imgCells.length) {
          i++;
          continue;
        }
        var detailRows = [];
        var j = i + 1;
        while (j < rows.length && !isImageBandRow(rows[j])) {
          detailRows.push(rows[j]);
          j++;
        }
        imgCells.forEach(function (imgTd, colIdx) {
          var card = buildCard(imgTd, detailRows, colIdx);
          if (card) grid.appendChild(card);
        });
        i = j;
      }

      if (!grid.querySelector(".v-product")) return;
      try {
        tbl.parentNode.insertBefore(grid, tbl);
        tbl.style.setProperty("display", "none", "important");
        tbl.setAttribute("data-mc-photo-cardified", "1");
      } catch (eLiftPhoto) {}
    });
  }

  function tagBrandPlp() {
    try {
      var path = String(global.location.pathname || "").toLowerCase();
      var h1 = d.querySelector("h1");
      var h1t = (h1 && h1.textContent) || "";
      /* Live nav (2026-07): Mahjong 202–204 (+ Game Room 194); Saranoni blankets
         205–209 (+ Luxe 196). Older code wrongly tagged 202–206 as Saranoni. */
      var isMahjong =
        /\/category-s\/(194|202|203|204)\.htm/i.test(path) ||
        /mahjong/i.test(h1t);
      var isSaranoni =
        /\/category-s\/(196|205|206|207|208|209)\.htm/i.test(path) ||
        /saranoni/i.test(h1t);
      /* Steve Silver furniture trees: Living Room / Dining / Bedroom + children. */
      var isSteveSilver =
        /\/category-s\/(139|142|147|149|157|175|177|178|179|187|188|193|195|197|198|199|210|211|212|213|214|215|216|217)\.htm/i.test(
          path
        );
      if (!isSteveSilver) {
        try {
          isSteveSilver = !!(
            d.querySelector(
              '#content_area a[href*="-p/"][href*="SS-" i], #content_area a[href*="/SS-" i]'
            ) || /steve\s*silver/i.test(h1t)
          );
        } catch (eSs) {}
      }
      /* Prefer specific brand when cats overlap (none currently do). */
      if (isMahjong) {
        d.documentElement.classList.add("mc-mahjong-plp");
        if (d.body) d.body.classList.add("mc-mahjong-plp");
        d.documentElement.classList.remove("mc-saranoni-plp");
        if (d.body) d.body.classList.remove("mc-saranoni-plp");
      } else if (isSaranoni) {
        d.documentElement.classList.add("mc-saranoni-plp");
        if (d.body) d.body.classList.add("mc-saranoni-plp");
      }
      if (isSteveSilver && !isMahjong && !isSaranoni) {
        d.documentElement.classList.add("mc-steve-silver-plp");
        if (d.body) d.body.classList.add("mc-steve-silver-plp");
      }
    } catch (eTag) {}
  }
  function tagSaranoniPlp() {
    tagBrandPlp();
  }

  function upgradeFreeShipIcons() {
    try {
      d.querySelectorAll("img[src*='Icon_FreeShipping_Small' i]").forEach(function (img) {
        var src = String(img.getAttribute("src") || "");
        img.setAttribute(
          "src",
          src.replace(/Icon_FreeShipping_Small\.gif/i, "Icon_FreeShipping.gif")
        );
        try {
          img.style.maxHeight = "22px";
          img.style.width = "auto";
        } catch (eSt) {}
      });
    } catch (eUp) {}
  }

  function runCardify() {
    try {
      tagSaranoniPlp();
      ensureCardifyCss();
      cardifyLegacyNameFirstTables();
      cardifyLegacyPhotoFirstTables();
      upgradeFreeShipIcons();
    } catch (eCardify) {}
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", runCardify);
  else runCardify();
  try {
    tagSaranoniPlp();
  } catch (eTag0) {}
  [300, 1000, 2500].forEach(function (ms) {
    global.setTimeout(runCardify, ms);
  });
  try {
    if (global.matchMedia) {
      global.matchMedia("(max-width: 991px)").addListener(function () {
        runCardify();
      });
    }
  } catch (eListen) {}
})(window);
/* Menu typography/geometry is now handled purely in custom-safe.css
   (RH-style block, doubled #display_menu_1#display_menu_1 selectors) after
   forceMenuTypography was removed from the template. The former JS
   menu-override racing script was removed 2026-07-04 — no longer needed. */


/* Cart float position/size is already owned by a native template script
   (template.min.js, ~100ms interval — see cart glitch investigation
   2026-07-04) that runs faster than anything we could add here without
   fighting it. A prior attempt to also pin the cart from this file caused
   a continuous ~10x/second oscillation between the two scripts' values —
   removed entirely; do not re-add cart positioning here. */

/* 2026-07-06 SITEWIDE HEADER NAV CRAMMED — a live DB-template script (not in
   our local template_266.html backup, so it can't be edited directly) sets
   inline `justify-content:space-between; width:60%; gap:0 !important` on
   ul.vnav--horizontal.vnav--level1, crushing every category label together
   ("GAME ROOMLIVING ROOMDINING..."). Inline !important beats ANY external
   stylesheet rule regardless of specificity, so the CSS-only fix used for
   #display_menu_1 (custom-safe.css, doubled-ID block) can't reach this
   nested <ul>.
   2026-07-07 UPDATE: the one-time-plus-retries pass (300/1000/2500ms) was
   confirmed to NOT hold — the native script re-applies gap:0/space-between
   on later re-renders (e.g. any responsive re-layout after those retries
   elapse), silently reverting the fix after the initial window. Switched to
   MutationObserver so the correction re-applies immediately any time the
   offending script rewrites the inline style, the same pattern used for the
   Saranoni mobile fix below. */
(function () {
  function applyNavFix(el) {
    el.style.setProperty("justify-content", "center", "important");
    el.style.setProperty("width", "auto", "important");
    el.style.setProperty("max-width", "none", "important");
    el.style.setProperty("gap", "34px", "important");
  }
  function isBad(el) {
    return el.style.gap !== "34px" || el.style.justifyContent !== "center";
  }
  function fixHeaderNavSpacing() {
    document
      .querySelectorAll(
        "header.header #display_menu_1 ul.vnav--horizontal.vnav--level1, header.header #display_menu_1 > ul.vnav--horizontal"
      )
      .forEach(function (el) {
        if (isBad(el)) applyNavFix(el);
        if (!el.__mcNavWatched) {
          el.__mcNavWatched = true;
          var observer = new MutationObserver(function () {
            if (isBad(el)) applyNavFix(el);
          });
          observer.observe(el, { attributes: true, attributeFilter: ["style"] });
        }
      });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fixHeaderNavSpacing);
  } else {
    fixHeaderNavSpacing();
  }
  /* 2026-07-07: REMOVED window.addEventListener("resize", fixHeaderNavSpacing).
     User reported the Molly Olson PDP "glitching really bad" on iPhone every
     time the screen was touched. iOS Safari fires resize repeatedly as its
     address bar animates in/out during scroll/touch — this listener has no
     page-type guard (runs on every page with the header nav, including
     Molly Olson), so every one of those resize events re-ran the fix. If a
     native script also reacts to resize by resetting the same inline
     styles, that's the exact two-scripts-fighting oscillation pattern
     already documented as dangerous for the cart float elsewhere in this
     file. The MutationObserver above already re-applies the fix the instant
     the style attribute changes for ANY reason, so this resize listener was
     redundant on top of being the likely glitch source — removed rather
     than guarded, since it added no coverage the observer doesn't already
     provide. */
  [300, 1000, 2500].forEach(function (ms) {
    window.setTimeout(fixHeaderNavSpacing, ms);
  });
})();

/* 2026-07-07 CART ICON DUPLICATE/OVERSIZED SVG — user-confirmed fix.
   template.min.js runs a ~100ms-interval script matching
   [class*=mc-cart-float], which also matches the inner
   svg.mc-cart-float__icon (not just the outer <a>), and force-sets that
   svg's inline style to width:52px/height:52px/display:flex !important
   every cycle. Inline !important beats any stylesheet rule regardless of
   specificity or source order (same category of bug as the header-nav and
   Saranoni-layout fixes above), so a CSS-only `display:none` cannot hold —
   confirmed live it gets reverted within ~100ms. MutationObserver re-applies
   display:none the instant the script rewrites the style attribute, the
   same pattern already proven safe for the two fixes above.

   Hiding the svg alone leaves the cart button completely blank (confirmed
   live via screenshot) — custom-safe.css has a background-image glyph
   replacement rule for the anchor, but several OTHER stylesheet rules also
   target the same anchor with background-image:initial and the cascade
   order among them isn't reliably winnable from CSS alone. So this script
   also paints the same pixel-identical cart glyph as an inline
   background-image directly on the anchor — inline styles beat every
   stylesheet rule regardless of source order, guaranteeing the icon shows
   regardless of which CSS rule would otherwise have won. */
(function () {
  var CART_GLYPH =
    'url("data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%2523111111%22%3E%3Cpath%20d%3D%22M7%2018c-1.1%200-2%20.9-2%202s.9%202%202%202%202-.9%202-2-.9-2-2-2zm10%200c-1.1%200-2%20.9-2%202s.9%202%202%202%202-.9%202-2-.9-2-2-2zM6.2%206l.4%202h12.2c.5%200%20.9.2%201.2.6.3.4.3.9.2%201.4l-1.2%205.2c-.2.7-.8%201.2-1.6%201.2H8.1c-.8%200-1.4-.5-1.6-1.2L4.3%204H2V2h3.1c.7%200%201.3.5%201.4%201.2L6.2%206zm1.3%209h9.8l1.1-5H6.6l.9%205z%22%2F%3E%3C%2Fsvg%3E")';

  function fixCartIcon() {
    document.querySelectorAll("svg.mc-cart-float__icon").forEach(function (svg) {
      if (svg.style.display !== "none") {
        svg.style.setProperty("display", "none", "important");
      }
      if (!svg.__mcCartIconWatched) {
        svg.__mcCartIconWatched = true;
        var observer = new MutationObserver(function () {
          if (svg.style.display !== "none") {
            svg.style.setProperty("display", "none", "important");
          }
        });
        observer.observe(svg, { attributes: true, attributeFilter: ["style"] });
      }
    });
    document.querySelectorAll("a.mc-cart-float, .mc-cart-float").forEach(function (anchor) {
      if (anchor.style.backgroundImage.indexOf("mc-cart-float__icon") === -1 &&
          !anchor.style.backgroundImage) {
        anchor.style.setProperty("background-image", CART_GLYPH, "important");
        anchor.style.setProperty("background-repeat", "no-repeat", "important");
        anchor.style.setProperty("background-position", "center center", "important");
        anchor.style.setProperty("background-size", "20px 20px", "important");
      }
      if (!anchor.__mcCartBgWatched) {
        anchor.__mcCartBgWatched = true;
        var observer2 = new MutationObserver(function () {
          if (!anchor.style.backgroundImage || anchor.style.backgroundImage === "none") {
            anchor.style.setProperty("background-image", CART_GLYPH, "important");
            anchor.style.setProperty("background-repeat", "no-repeat", "important");
            anchor.style.setProperty("background-position", "center center", "important");
            anchor.style.setProperty("background-size", "20px 20px", "important");
          }
        });
        observer2.observe(anchor, { attributes: true, attributeFilter: ["style"] });
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fixCartIcon);
  } else {
    fixCartIcon();
  }
  [300, 1000, 2500].forEach(function (ms) {
    window.setTimeout(fixCartIcon, ms);
  });
})();

/* 2026-07-07 SHOPPING CART TABLE WIDTH — CSS alone could not fix this.
   User sent a real phone screenshot at 393px CSS width showing genuine
   overflow (Total/Qty/RECALCULATE/shipping fields all cut off). This
   session's testing tool has been stuck reporting a 666px viewport all
   along, so verifying against a real narrow width required manually
   constraining html to max-width:393px and re-measuring — that's how
   this was actually caught and fixed.

   #v65-cart-table is nested inside #v65-cart-table-container (another
   <table width="100%">) inside a <form>, inside several more wrapper
   divs. Every one of those levels correctly computes width:100% of its
   own parent — confirmed live via getBoundingClientRect at each level —
   but NONE of them ever resolved to less than ~389px even after adding
   max-width:100% (and later `form *{max-width:100%}` as a nuclear
   option) to every level in the chain, table-layout:fixed on all three
   nested tables, and constraining the grid's own template-columns to
   minmax(0,...). All of those are the "should just work" ways to shrink
   a table to its container in CSS, and none of them changed the
   measured width by even one pixel — this table is anchored to a
   ~389px content-driven size at some point in the chain that resists
   every percentage-based override tried. (Confirmed a hardcoded pixel
   width DOES work: manually setting the row's own width to 297px
   inline correctly forced it to shrink, proving the layout CAN
   respond to an explicit size — CSS just isn't managing to hand it one
   through this particular nested-table structure.)

   Given that, this sets the table's width in actual pixels via JS,
   computed from #content_area's real rendered width (the one reliably
   accurate width value in the whole chain) minus its own padding.
   One-time on load + a couple of retries for late-loading content —
   deliberately NOT on a resize listener, per the iOS Safari
   toolbar-resize glitch lesson from the header-nav fix above. */
(function () {
  function fixCartTableWidth() {
    var contentArea = document.getElementById("content_area");
    var cartTable = document.getElementById("v65-cart-table");
    var containerTable = document.getElementById("v65-cart-table-container");
    if (!contentArea || !cartTable) return;
    if (window.innerWidth > 991) return;
    var availWidth = contentArea.getBoundingClientRect().width - 32;
    if (availWidth <= 0) return;
    [cartTable, containerTable].forEach(function (t) {
      if (!t) return;
      t.style.setProperty("width", availWidth + "px", "important");
      t.style.setProperty("max-width", availWidth + "px", "important");
      t.style.setProperty("table-layout", "fixed", "important");
    });

    /* 2026-07-07: same bug, separate table. #v65-cart-shipping-details
       (Country/State/Zip dropdowns) is a COMPLETELY DIFFERENT nested
       table from the cart-items one above — fixing the item table did
       not touch this one. User's phone screenshot showed the Country/
       State dropdowns cut off past the right edge even after the item
       row was fixed. Same root cause, same fix: compute the real
       available width from this table's own container and set it in
       pixels directly, since percentage cascade doesn't reliably reach
       through this nested-table markup either. */
    var shipContainer = document.getElementById("v65-cart-shipping-details-container");
    var shipTable = document.getElementById("v65-cart-shipping-details");
    var shipWrapperTable = document.getElementById("v65-cart-shipping-details-wrapper");
    if (shipContainer && shipTable) {
      var shipAvailWidth = shipContainer.getBoundingClientRect().width - 16;
      if (shipAvailWidth > 0) {
        [shipTable, shipWrapperTable].forEach(function (t) {
          if (!t) return;
          t.style.setProperty("width", shipAvailWidth + "px", "important");
          t.style.setProperty("max-width", shipAvailWidth + "px", "important");
          t.style.setProperty("table-layout", "fixed", "important");
        });
      }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fixCartTableWidth);
  } else {
    fixCartTableWidth();
  }
  [300, 1000, 2500].forEach(function (ms) {
    window.setTimeout(fixCartTableWidth, ms);
  });
})();

/* 2026-07-08 DUPLICATE HOME NAV — fight inline display:flex on desktop bar.
   Homepage keeps hero .hero-menu only; hide header .mc-header-desktop-bar. */
(function hideHomeDuplicateNav() {
  function isTrueHome() {
    try {
      var p = String(location.pathname || "").toLowerCase().replace(/\/+/g, "/");
      while (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
      var homePath =
        p === "" ||
        p === "/" ||
        /\/default\.asp$/.test(p) ||
        /\/default\.html?$/.test(p) ||
        /\/index\.html?$/.test(p);
      if (!homePath) return false;
      if (document.body && document.body.classList.contains("productdetails")) return false;
      if (document.getElementById("v65-product-parent")) return false;
      return true;
    } catch (e) {
      return false;
    }
  }
  function hardHide(el) {
    if (!el || el.getAttribute("data-mc-home-nav-hidden") === "1") return;
    try {
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.style.setProperty("height", "0", "important");
      el.style.setProperty("max-height", "0", "important");
      el.style.setProperty("min-height", "0", "important");
      el.style.setProperty("overflow", "hidden", "important");
      el.style.setProperty("opacity", "0", "important");
      el.style.setProperty("pointer-events", "none", "important");
      el.style.setProperty("margin", "0", "important");
      el.style.setProperty("padding", "0", "important");
      el.setAttribute("data-mc-home-nav-hidden", "1");
    } catch (eHide) {}
  }
  function hide() {
    if (!isTrueHome()) return;
    var sel =
      "header.header > .mc-header-desktop-bar," +
      "header.header .mc-header-desktop-bar[data-mc-header-bar]," +
      "header.header .microblock.main-menu," +
      "header.header > .hidden-xs.col-xs-12:has(#display_menu_1)," +
      "header.header > .col-xs-12.hidden-xs:has(#display_menu_1)";
    var bars = document.querySelectorAll(sel);
    var i;
    for (i = 0; i < bars.length; i++) hardHide(bars[i]);
    /* Also hide any #display_menu_1 that is NOT inside the hero */
    var menus = document.querySelectorAll("#display_menu_1");
    for (i = 0; i < menus.length; i++) {
      var m = menus[i];
      if (
        m.closest(".hero-menu") ||
        m.closest("#slideshow-container") ||
        m.closest("#if_homepage")
      ) {
        continue;
      }
      var wrap = m.closest(".mc-header-desktop-bar") || m.closest(".microblock.main-menu") || m;
      if (wrap.getAttribute("data-mc-home-nav-hidden") === "1") continue;
      hardHide(wrap);
    }
  }
  hide();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hide);
  window.addEventListener("load", hide);
  [0, 100, 300, 800, 1500, 3000, 6000].forEach(function (ms) {
    window.setTimeout(hide, ms);
  });
  try {
    var mo = new MutationObserver(function () {
      if (!isTrueHome()) return;
      window.clearTimeout(window.__MC_HOME_NAV_HIDE_T__);
      window.__MC_HOME_NAV_HIDE_T__ = window.setTimeout(hide, 300);
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    window.setTimeout(function () {
      try {
        mo.disconnect();
      } catch (eDisc) {}
    }, 45000);
  } catch (eMo) {}
})();

/* MC_NAV_L3_FLYOUT_RIGHT_20260711 — template restoreMenu() forces ALL submenus
   to top:100%/left:0, so level-3 stacks over sibling level-2 links. Push L3
   to the right. Also hot-load the auth fix file under a NEW name because
   /mc-pdp-auth-cta-fix.js is stuck on an old CDN/server copy. */
(function (global) {
  "use strict";
  var d = global.document;
  if (!d || global.__MC_NAV_L3_FLYOUT_FIX__) return;
  global.__MC_NAV_L3_FLYOUT_FIX__ = true;

  function fixLevel3Flyouts() {
    try {
      d.querySelectorAll(
        "header.header #display_menu_1 ul.vnav--level2 > li > ul," +
          "header.header #display_menu_1 .vnav--level2 > li > .vnav__subnav," +
          "header.header #display_menu_1 ul.vnav--level3"
      ).forEach(function (el) {
        if (!el || !el.style) return;
        /* Skip if this ul is a direct child of a top-level li (that's L2). */
        var parentLi = el.parentElement;
        if (!parentLi || parentLi.tagName !== "LI") return;
        var parentUl = parentLi.parentElement;
        if (
          parentUl &&
          parentUl.classList &&
          (parentUl.classList.contains("vnav--level1") ||
            parentUl.classList.contains("vnav--horizontal"))
        ) {
          return;
        }
        el.style.setProperty("position", "absolute", "important");
        el.style.setProperty("top", "0", "important");
        el.style.setProperty("left", "100%", "important");
        el.style.setProperty("right", "auto", "important");
        el.style.setProperty("margin-left", "2px", "important");
        el.style.setProperty("z-index", "100450", "important");
        el.style.setProperty("min-width", "200px", "important");
        el.style.setProperty("background", "#fff", "important");
      });
      d.querySelectorAll("header.header #display_menu_1 ul.vnav--level2 > li").forEach(
        function (li) {
          if (!li || !li.style) return;
          li.style.setProperty("position", "relative", "important");
        }
      );
    } catch (eFix) {}
  }

  function loadAuthHotfix() {
    try {
      /* Main auth path is authoritative as of 20260712pdp04.
         Do not dual-load mc-pdp-auth-cta-fix-20260711.js — that file still
         seeded duplicate -2T alt thumbs and fought layout locks. */
      if (String(global.__MC_PDP_AUTH_CTA_FIX_VER__ || "").indexOf("20260712") === 0) {
        global.__MC_AUTH_HOTFIX_LOADED__ = true;
        return;
      }
      global.__MC_AUTH_HOTFIX_LOADED__ = true;
    } catch (eLoad) {}
  }

  function loadMobileNavSoftAddHotfix() {
    try {
      if (global.__MC_MOBILE_NAV_SOFTADD_LOADER__) return;
      if (String(global.__MC_MOBILE_NAV_SOFTADD_VER__ || "").indexOf("20260712nav") === 0) {
        global.__MC_MOBILE_NAV_SOFTADD_LOADER__ = true;
        return;
      }
      if (d.querySelector('script[src*="mc-mobile-nav-softadd-20260712"]')) {
        global.__MC_MOBILE_NAV_SOFTADD_LOADER__ = true;
        return;
      }
      global.__MC_MOBILE_NAV_SOFTADD_LOADER__ = true;
      var s = d.createElement("script");
      s.src = "/v/vspfiles/js/mc-mobile-nav-softadd-20260712.js?v=20260712nav03";
      s.async = false;
      (d.head || d.documentElement).appendChild(s);
    } catch (eNav) {}
  }

  fixLevel3Flyouts();
  loadAuthHotfix();
  loadMobileNavSoftAddHotfix();
  [80, 250, 600, 1200, 2200, 4500, 8000].forEach(function (ms) {
    global.setTimeout(function () {
      fixLevel3Flyouts();
      loadAuthHotfix();
      loadMobileNavSoftAddHotfix();
    }, ms);
  });
  global.addEventListener("resize", fixLevel3Flyouts);
  try {
    var menu = d.getElementById("display_menu_1");
    if (menu && global.MutationObserver) {
      var t = null;
      new global.MutationObserver(function () {
        global.clearTimeout(t);
        t = global.setTimeout(fixLevel3Flyouts, 30);
      }).observe(menu, {
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
        childList: true,
      });
    }
  } catch (eMo2) {}
})(window);
