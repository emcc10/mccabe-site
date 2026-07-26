
/* MC_FORCE_LOVEY_STYLE_CTA REMOVED 20260722manual4 */

/* Before baked enforcer bridge / alt-view: stop SS PDP freezes. */
(function (g) {
  "use strict";
  try {
    var p = String((g.location && g.location.pathname) || "").toLowerCase();
    var onPdp = /\/product-p\//.test(p) || !!(g.document && g.document.getElementById("v65-product-parent"));
    if (!onPdp) return;
    var prev = parseInt(String(g.__MC_PLP_ENFORCER_VER__ || "").replace(/\D/g, ""), 10);
    if (!(prev >= 20269999999)) g.__MC_PLP_ENFORCER_VER__ = "20269999999pricestack";
    g.mcPlpEnforcerRun = function () {};
    g.mcStripPriceZeroCents = function () {};
    /* Must run before alt-view-row / sticky enforcer install observers. */
    if (/\/product-p\/ss-/.test(p) && !g.__MC_SS_MO_NEUTER__) {
      g.__MC_SS_MO_NEUTER__ = true;
      g.MutationObserver = function () {
        this.observe = function () {};
        this.disconnect = function () {};
        this.takeRecords = function () {
          return [];
        };
      };
    }
  } catch (eEarly) {}
})(window);

/* SS heroes + "Main product image" thumbs: many -2.jpg URLs 404; force -1.jpg early. */
(function (g) {
  "use strict";
  function fixSsBrokenPhotosEarly() {
    try {
      var path = String((g.location && g.location.pathname) || "").toLowerCase();
      if (!/\/product-p\/ss-/.test(path) && !/ss-alex/i.test(path)) return;
      var pc = String(
        ((g.document.querySelector('#v65-product-parent input[name="ProductCode"], input[name="ProductCode"]') || {})
          .value) || ""
      ).toUpperCase();
      if (!pc && /\/product-p\/(ss-[a-z0-9-]+)\.htm/i.test(path)) {
        pc = RegExp.$1.toUpperCase();
      }
      if (!pc) return;
      var want = "/v/vspfiles/photos/" + pc + "-1.jpg";
      var img = g.document && g.document.getElementById("product_photo");
      if (img) {
        var src = String(img.getAttribute("src") || img.src || "");
        if (!src || /\/-2T?\./i.test(src) || (img.complete && !img.naturalWidth)) {
          img.setAttribute("src", want);
          img.src = want;
          img.removeAttribute("srcset");
          var a = img.closest && img.closest("a");
          if (a) a.setAttribute("href", want);
        }
      }
      g.document.querySelectorAll("#altviews img, .altviews img, #mc-pdp-alt-view-row img").forEach(function (thumb) {
        var tsrc = String(thumb.getAttribute("src") || thumb.src || "");
        var alt = String(thumb.alt || "");
        if (!/-2\.(?:jpe?g|png|webp)/i.test(tsrc)) return;
        if (/Main product image/i.test(alt) || (thumb.complete && !thumb.naturalWidth)) {
          thumb.setAttribute("src", want);
          thumb.src = want;
        }
      });
    } catch (e) {}
  }
  if (g.document && g.document.readyState === "loading") {
    g.document.addEventListener("DOMContentLoaded", fixSsBrokenPhotosEarly);
  } else {
    fixSsBrokenPhotosEarly();
  }
  [0, 200, 800, 2000, 5000].forEach(function (ms) {
    g.setTimeout(fixSsBrokenPhotosEarly, ms);
  });
})(window);

/**
 * PDP retail/member/sale stack repair — works without template_266 rebake.
 * MC_PDP_PRICE_STACK_JS_20260522stack
 */
(function (g) {
  "use strict";
  if (g.__mcPdpPriceStackJs) return;
  g.__mcPdpPriceStackJs = true;

  function isPdp() {
    if (g.document.getElementById("v65-product-parent")) return true;
    var p = String(g.location.pathname || "").toLowerCase();
    return /\.htm(?:\?|$)/i.test(p) && !!g.document.querySelector(".colors_pricebox");
  }

  function isPalliserPdp() {
    try {
      if (typeof g.mcIsPalliserProduct === "function" && g.mcIsPalliserProduct()) return true;
      if (g.document.body && g.document.body.classList.contains("mc-palliser-pdp")) return true;
    } catch (ePal) {}
    return false;
  }

  function isSaranoniPdp() {
    try {
      if (g.document.body && g.document.body.classList.contains("mc-saranoni-pdp")) return true;
      var codeEl =
        g.document.querySelector("#ProductCode, input[name='ProductCode'], #v65-product-parent [name='ProductCode']");
      var code = codeEl ? String(codeEl.value || codeEl.textContent || "").trim().toUpperCase() : "";
      if (/^SAR[-_]/.test(code)) return true;
    } catch (eSar) {}
    return false;
  }

  function parseMoney(text) {
    if (typeof g.parseMcCurrency === "function") {
      return Number(g.parseMcCurrency(text == null ? "" : String(text))) || 0;
    }
    var src = String(text == null ? "" : text);
    var m = src.match(/\$[\d,]+(?:\.\d+)?/);
    if (m) return parseFloat(m[0].replace(/[$,]/g, "")) || 0;
    m = src.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) || 0 : 0;
  }

  function fmtMoney(n) {
    n = Number(n || 0);
    if (!(n > 0)) return "";
    if (typeof g.mcFmtMoney === "function") return g.mcFmtMoney(n);
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function readRetailAmount() {
    var el =
      g.document.querySelector(".mc-pdp-retail-row .product_list_price") ||
      g.document.querySelector(".mc-pdp-retail-row font.product_list_price") ||
      g.document.querySelector("#v65-product-parent .product_list_price") ||
      g.document.querySelector("#content_area .product_list_price");
    return el ? parseMoney(el.textContent || "") : 0;
  }

  function readSaleFromPriceBox() {
    var box =
      g.document.querySelector("#v65-product-parent .colors_pricebox") ||
      g.document.querySelector("#content_area .colors_pricebox");
    if (!box) return 0;
    var amounts = [];
    var re = /\$[\d,]+(?:\.\d{2})?/g;
    var m;
    var text = box.textContent || "";
    while ((m = re.exec(text)) !== null) {
      var v = parseMoney(m[0]);
      if (v > 0) amounts.push(v);
    }
    if (amounts.length < 2) return 0;
    amounts.sort(function (a, b) {
      return b - a;
    });
    var retail = amounts[0];
    var sale = amounts[amounts.length - 1];
    if (sale > 0 && sale < retail) return sale;
    if (amounts.length >= 2 && amounts[1] < retail) return amounts[1];
    return 0;
  }

  function readSaleFromVisibleNodes() {
    var sels =
      "#v65-product-parent .colors_pricebox .product_sale_price, #v65-product-parent .colors_pricebox .product_saleprice, " +
      "#v65-product-parent .colors_pricebox font.product_sale_price";
    var nodes = g.document.querySelectorAll(sels);
    var i;
    for (i = 0; i < nodes.length; i++) {
      var amt = parseMoney(nodes[i].textContent || "");
      if (amt > 0) return amt;
    }
    return 0;
  }

  function readSaleFromPageHtml() {
    var html = "";
    try {
      html = g.document.documentElement.innerHTML || "";
    } catch (eH) {}
    var patterns = [
      /\bSalePrice\s*[=:]\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
      /\bwindow\.SalePrice\s*=\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
      /["']SalePrice["']\s*:\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
      /\bHowToGetSalePrice\b[^0-9]{0,40}(\d[\d,]*(?:\.\d+)?)/gi,
    ];
    var pi;
    for (pi = 0; pi < patterns.length; pi++) {
      var re = patterns[pi];
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(html)) !== null) {
        var p = parseMoney(m[1]);
        if (p > 0 && p < 50000000) return p;
      }
    }
    return 0;
  }

  function resolvePdpSaleAmount() {
    if (g.__mcPdpSaleAmtCached > 0) return g.__mcPdpSaleAmtCached;
    var amt = readSaleFromVisibleNodes();
    if (!(amt > 0)) amt = readSaleFromPriceBox();
    if (!(amt > 0)) {
      g.document.querySelectorAll("#v65-product-parent input, #content_area input").forEach(function (inp) {
        if (amt > 0) return;
        var nm = ((inp.name || "") + " " + (inp.id || "")).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (nm.indexOf("saleprice") === -1) return;
        amt = parseMoney(inp.value || inp.getAttribute("value") || "");
      });
    }
    if (!(amt > 0) && typeof g.getVolusionAddToCartSeatPrice === "function") {
      amt = Number(g.getVolusionAddToCartSeatPrice(g.document)) || 0;
    }
    if (!(amt > 0) && typeof g.tryReadHowToGetSalePrice === "function") {
      var retail = readRetailAmount();
      amt = Number(g.tryReadHowToGetSalePrice(retail, true)) || 0;
    }
    if (!(amt > 0)) amt = readSaleFromPageHtml();
    if (!(amt > 0)) {
      var retailAmt = readRetailAmount();
      var opt =
        g.document.querySelector("#priceWithOptions") ||
        g.document.querySelector("#priceWithOptionsNoTax");
      if (retailAmt > 0 && opt) {
        var optAmt = parseMoney(
          (opt.getAttribute && (opt.getAttribute("value") || opt.getAttribute("content"))) ||
            opt.textContent ||
            ""
        );
        if (optAmt > 0 && optAmt < retailAmt) amt = optAmt;
      }
    }
    if (amt > 0) g.__mcPdpSaleAmtCached = amt;
    return amt;
  }

  function hasStackMarkers() {
    return !!g.document.querySelector(
      ".mc-pdp-member-pricing, .mc-pdp-retail-row, #v65-product-parent .mc-pdp-member-line"
    );
  }

  function ensureMemberWrap() {
    var wrap = g.document.querySelector(".mc-pdp-member-pricing");
    if (wrap) return wrap;
    var root = g.document.getElementById("v65-product-parent") || g.document.getElementById("content_area");
    if (!root) return null;
    var lines = root.querySelectorAll(".mc-pdp-member-line");
    if (!lines.length) return null;
    wrap = g.document.createElement("div");
    wrap.className = "mc-pdp-member-pricing";
    var first = lines[0];
    if (!first || !first.parentNode) return null;
    first.parentNode.insertBefore(wrap, first);
    var i;
    for (i = 0; i < lines.length; i++) {
      if (lines[i].parentNode !== wrap) wrap.appendChild(lines[i]);
    }
    return wrap;
  }

  function hideNativeSale() {
    var box = g.document.querySelector("#v65-product-parent .colors_pricebox");
    if (box) {
      box.querySelectorAll(
        ".product_saleprice, .product_sale_price, font.product_sale_price, .product_productprice"
      ).forEach(function (node) {
        if (node.closest && node.closest(".mc-pdp-member-line--sale")) return;
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("opacity", "0", "important");
      });
    }
    g.document
      .querySelectorAll(
        "#v65-product-parent .product_sale_price, #v65-product-parent .product_saleprice, #v65-product-parent font.product_sale_price"
      )
      .forEach(function (node) {
        if (node.closest && node.closest(".mc-pdp-member-line--sale")) return;
        if (node.closest && node.closest(".v-product-grid, .mc-related-carousel")) return;
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("opacity", "0", "important");
      });
  }

  function mcEnsurePdpPriceStack() {
    if (!isPdp()) return false;
    if (isSaranoniPdp()) return false;
    if (isPalliserPdp()) {
      if (typeof g.mcDedupePalliserMemberPricingBlocks === "function") {
        try {
          g.mcDedupePalliserMemberPricingBlocks();
        } catch (eDed) {}
      }
      if (typeof g.mcRepositionPalliserMemberPricing === "function") {
        try {
          g.mcRepositionPalliserMemberPricing();
        } catch (ePos) {}
      }
      if (typeof g.mcHidePalliserNativePriceUi === "function") {
        try {
          g.mcHidePalliserNativePriceUi();
        } catch (eHide) {}
      }
      return !!g.document.querySelector(".mc-pdp-member-pricing--canonical");
    }
    if (!hasStackMarkers()) {
      hideNativeSale();
      return false;
    }
    var wrap = ensureMemberWrap() || g.document.querySelector(".mc-pdp-member-pricing");
    try {
      g.document.body.classList.add("mc-pdp-price-stack");
    } catch (e0) {}
    var saleAmt = resolvePdpSaleAmount();
    hideNativeSale();
    var loggedIn = false;
    try {
      loggedIn =
        g.document.body.classList.contains("mc-member-logged-in") ||
        !!g.sessionStorage.getItem("mc_recent_member_auth");
    } catch (e1) {}
    if (!loggedIn && wrap && !wrap.querySelector(".mc-pdp-member-line--sale")) {
      if (!(saleAmt > 0)) saleAmt = resolvePdpSaleAmount();
      if (saleAmt > 0) {
        var line = g.document.createElement("div");
        line.className = "mc-pdp-member-line mc-pdp-member-line--sale";
        line.innerHTML =
          '<span class="mc-pdp-member-line__label">Sale Price</span>' +
          '<span class="mc-pdp-member-line__amount">' +
          fmtMoney(saleAmt) +
          "</span>";
        var anchor =
          wrap.querySelector(".mc-pdp-member-line--locked") || wrap.querySelector(".mc-pdp-member-line");
        if (anchor && anchor.parentNode) {
          if (anchor.nextSibling) anchor.parentNode.insertBefore(line, anchor.nextSibling);
          else anchor.parentNode.appendChild(line);
        } else {
          wrap.appendChild(line);
        }
      }
    }
    if (wrap) {
      wrap.querySelectorAll(".mc-pdp-member-line").forEach(function (ln) {
        ln.style.setProperty("display", "flex", "important");
        ln.style.setProperty("flex-direction", "column", "important");
        ln.style.setProperty("position", "static", "important");
        ln.style.setProperty("width", "100%", "important");
      });
    }
    return true;
  }

  g.mcEnsurePdpPriceStack = mcEnsurePdpPriceStack;

  function run() {
    try {
      mcEnsurePdpPriceStack();
    } catch (eR) {}
  }

  run();
  g.document.addEventListener("DOMContentLoaded", run);
  g.addEventListener("load", run);
  [0, 400, 1200, 3000, 6000].forEach(function (ms) {
    g.setTimeout(run, ms);
  });
})(window);
