/**
 * PDP retail/member/sale stack repair — works without template_266 rebake.
 * MC_PDP_PRICE_STACK_JS_20260522
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
    var m = String(text == null ? "" : text).match(/\$[\d,]+(?:\.\d+)?/);
    return m ? parseFloat(m[0].replace(/[$,]/g, "")) || 0 : 0;
  }

  function fmtMoney(n) {
    n = Number(n || 0);
    if (!(n > 0)) return "";
    if (typeof g.mcFmtMoney === "function") return g.mcFmtMoney(n);
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function cacheSale() {
    if (g.__mcPdpSaleAmtCached > 0) return g.__mcPdpSaleAmtCached;
    var amt = 0;
    g.document.querySelectorAll("#v65-product-parent input, #content_area input").forEach(function (inp) {
      if (amt > 0) return;
      var nm = ((inp.name || "") + " " + (inp.id || "")).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (nm.indexOf("saleprice") === -1) return;
      amt = parseMoney(inp.value || inp.getAttribute("value") || "");
    });
    if (!(amt > 0)) {
      var html = g.document.documentElement.innerHTML || "";
      var re = /\bSalePrice\s*[=:]\s*['"]?\$?([\d,]+(?:\.\d+)?)/gi;
      var m;
      while ((m = re.exec(html)) !== null) {
        var p = parseMoney(m[1]);
        if (p > 0) {
          amt = p;
          break;
        }
      }
    }
    if (!(amt > 0) && g.__mcMemberPricing && g.__mcMemberPricing.memberSeatPrice > 0) {
      amt = Number(g.__mcMemberPricing.memberSeatPrice) || 0;
    }
    if (amt > 0) g.__mcPdpSaleAmtCached = amt;
    return amt;
  }

  function hideNativeSale() {
    g.document
      .querySelectorAll(
        "#v65-product-parent .product_sale_price, #v65-product-parent .product_saleprice, #v65-product-parent font.product_sale_price"
      )
      .forEach(function (node) {
        if (node.closest && node.closest(".mc-pdp-member-line--sale")) return;
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("opacity", "0", "important");
      });
  }

  function mcEnsurePdpPriceStack() {
    if (!isPdp()) return false;
    var wrap = g.document.querySelector(".mc-pdp-member-pricing");
    if (!wrap && !g.document.querySelector(".mc-pdp-retail-row")) return false;
    try {
      g.document.body.classList.add("mc-pdp-price-stack");
    } catch (e0) {}
    cacheSale();
    hideNativeSale();
    var loggedIn = false;
    try {
      loggedIn =
        g.document.body.classList.contains("mc-member-logged-in") ||
        !!g.sessionStorage.getItem("mc_recent_member_auth");
    } catch (e1) {}
    if (!loggedIn && wrap && !wrap.querySelector(".mc-pdp-member-line--sale")) {
      var saleAmt = Number(g.__mcPdpSaleAmtCached) || cacheSale();
      if (saleAmt > 0) {
        var line = g.document.createElement("div");
        line.className = "mc-pdp-member-line mc-pdp-member-line--sale";
        line.innerHTML =
          '<span class="mc-pdp-member-line__label">Sale Price</span>' +
          '<span class="mc-pdp-member-line__amount">' +
          fmtMoney(saleAmt) +
          "</span>";
        var locked = wrap.querySelector(".mc-pdp-member-line--locked");
        if (locked && locked.parentNode) {
          if (locked.nextSibling) locked.parentNode.insertBefore(line, locked.nextSibling);
          else locked.parentNode.appendChild(line);
        } else wrap.appendChild(line);
      }
    }
    if (wrap) {
      wrap.querySelectorAll(".mc-pdp-member-line").forEach(function (line) {
        line.style.setProperty("display", "flex", "important");
        line.style.setProperty("flex-direction", "column", "important");
        line.style.setProperty("position", "static", "important");
        line.style.setProperty("width", "100%", "important");
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
