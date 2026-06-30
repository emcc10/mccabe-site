/**
 * PLP fixes — DOM-driven, scoped to inspected Volusion markup.
 * MC_PLP_ENFORCER_20260706b — Luxe PLP gap: editorial collapse, sort toolbar, SEO footer
 *
 * Thumbnails: .mc-plp-image-box; image element sized to the wrapper, object-fit: contain (no crop).
 */
(function (global) {
  "use strict";

  var VERSION = "20260706b";

  function plpVerNum(v) {
    var n = parseInt(String(v || "").replace(/\D/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }

  var PLP_MAT = "#ffffff";
  if (plpVerNum(global.__MC_PLP_ENFORCER_VER__) >= plpVerNum(VERSION)) return;
  global.__MC_PLP_ENFORCER_VER__ = VERSION;
  global.__MC_PLP_ENFORCER__ = true;

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
      document.body.classList.remove("is-home");
    }
    document.documentElement.classList.remove("mc-allow-home-hero");
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
    return /nophoto\.gif/i.test(String(src || ""));
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

  function organizeCategoryMeta(root) {
    root = root || document.getElementById("content_area");
    if (!root) return false;
    if (root.querySelector(".mc-category-meta")) return false;

    var hero = root.querySelector("#mc-cat-luxe-comforts");
    if (!hero || !hero.parentNode) return false;

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

    hero.parentNode.insertBefore(meta, hero);
    pruneLegacyCategoryChromeBeforeHero(hero);
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
      if (img.closest("#v65-product-related")) return;

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

  var PDP_AUTH_WANT = "20260625sarrepair2";

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
})(window);
