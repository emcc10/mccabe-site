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
