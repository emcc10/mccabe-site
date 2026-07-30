(function (g, d) {
  "use strict";

  var VERSION = "20260716ship2";
  var SARANONI_FREE_THRESHOLD = 99;

  var RATE_TYPES = {
    beanBagFree: /(?:bean\s*bag|\bbb\b).{0,35}free|free.{0,35}(?:bean\s*bag|\bbb\b)/i,
    saranoniFree: /saranoni.{0,35}free|free.{0,35}saranoni/i,
    whiteGlove: /white\s*glove|local\s+(?:white\s*glove\s+)?delivery/i,
    genericFree: /(?:^|\s)free\s+shipping(?:\s|$)/i,
  };

  function normalizeCode(value) {
    return String(value || "")
      .replace(/%2d/gi, "-")
      .replace(/\s+/g, "")
      .toUpperCase();
  }

  function productFamily(code) {
    var normalized = normalizeCode(code);
    if (/^SAR-/.test(normalized)) return "saranoni";
    if (/^BB-/.test(normalized) || normalized === "XL-CHINCHILLA") return "beanBag";
    return "other";
  }

  function money(value) {
    var parsed = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
    return isFinite(parsed) ? parsed : 0;
  }

  function normalizeZip(value) {
    var match = String(value || "").match(/\b(\d{5})(?:-\d{4})?\b/);
    return match ? match[1] : "";
  }

  function zipTierData() {
    return g.__MC_WHITE_GLOVE_ZIP_TIERS__ || null;
  }

  function whiteGloveQuote(value, weightSurcharge) {
    var zip = normalizeZip(value);
    var data = zipTierData();
    var entry = data && zip ? data.zips[zip] : null;
    if (!entry) return null;
    var extra = Math.max(0, money(weightSurcharge));
    return {
      zip: zip,
      eligible: true,
      distanceMiles: entry.distanceMiles,
      direction: entry.direction,
      tier: entry.tier,
      basePrice: entry.basePrice,
      directionSurcharge: entry.directionSurcharge,
      weightSurcharge: extra,
      total: entry.priceBeforeWeight + extra,
    };
  }

  function isDfwZip(value) {
    return !!whiteGloveQuote(value, 0);
  }

  function rateType(label) {
    var text = String(label || "").replace(/\s+/g, " ").trim();
    if (RATE_TYPES.beanBagFree.test(text)) return "beanBagFree";
    if (RATE_TYPES.saranoniFree.test(text)) return "saranoniFree";
    if (RATE_TYPES.whiteGlove.test(text)) return "whiteGlove";
    if (RATE_TYPES.genericFree.test(text)) return "genericFree";
    return "standard";
  }

  function summarizeCart(lines) {
    var summary = {
      lineCount: 0,
      beanBagCount: 0,
      saranoniCount: 0,
      otherCount: 0,
      saranoniSubtotal: 0,
    };

    (lines || []).forEach(function (line) {
      var family = productFamily(line && line.code);
      var quantity = Math.max(1, parseInt(line && line.quantity, 10) || 1);
      var total = money(line && line.total);
      summary.lineCount += 1;
      if (family === "beanBag") summary.beanBagCount += 1;
      else if (family === "saranoni") {
        summary.saranoniCount += 1;
        summary.saranoniSubtotal += total || money(line && line.unitPrice) * quantity;
      } else summary.otherCount += 1;
    });

    summary.onlyBeanBags = summary.beanBagCount > 0 && summary.saranoniCount === 0 && summary.otherCount === 0;
    summary.onlySaranoni = summary.saranoniCount > 0 && summary.beanBagCount === 0 && summary.otherCount === 0;
    summary.onlyFreeFamilies = summary.beanBagCount > 0 && summary.saranoniCount > 0 && summary.otherCount === 0;
    summary.saranoniQualifies = summary.saranoniSubtotal >= SARANONI_FREE_THRESHOLD;
    return summary;
  }

  function isRateAllowed(label, summary, zip) {
    var type = rateType(label);
    var cart = summary || summarizeCart([]);

    if (cart.onlyBeanBags) return type === "beanBagFree" || type === "genericFree";

    if (cart.onlySaranoni) {
      if (type === "beanBagFree" || type === "whiteGlove") return false;
      if (cart.saranoniQualifies) return type === "saranoniFree" || type === "genericFree";
      return type === "standard";
    }

    if (cart.onlyFreeFamilies) {
      if (type === "whiteGlove" || type === "beanBagFree") return false;
      if (cart.saranoniQualifies) return type === "saranoniFree" || type === "genericFree";
      return type === "standard";
    }

    if (type === "beanBagFree" || type === "saranoniFree" || type === "genericFree") return false;
    // Keep Volusion's White Glove dropdown visible before the ZIP is entered;
    // its own shipping rules select the applicable ZIP tier afterward.
    if (type === "whiteGlove") return !normalizeZip(zip) || isDfwZip(zip);
    return true;
  }

  function codeFromHref(href) {
    var text = String(href || "");
    var match = text.match(/[?&]ProductCode=([^&#]+)/i);
    if (!match) match = text.match(/\/product-p\/([^/?#]+)\.html?/i);
    if (!match) return "";
    try {
      return normalizeCode(decodeURIComponent(match[1]));
    } catch (e) {
      return normalizeCode(match[1]);
    }
  }

  function readCartLines(root) {
    if (!root || !root.querySelectorAll) return [];
    var seen = {};
    var lines = [];

    root.querySelectorAll('a[href*="ProductCode=" i], a[href*="/product-p/" i]').forEach(function (link) {
      var code = codeFromHref(link.getAttribute("href"));
      if (!code) return;
      var row = link.closest("tr") || link.closest("li") || link.parentElement;
      if (!row) return;
      var key = code + "|" + String(row.rowIndex || lines.length);
      if (seen[key]) return;
      seen[key] = true;

      var qtyInput = row.querySelector('input[name^="QTY" i], input[id="qty"], input[name*="quantity" i]');
      var prices = (row.textContent || "").match(/\$\s*[0-9,]+(?:\.\d{2})?/g) || [];
      lines.push({
        code: code,
        quantity: qtyInput ? qtyInput.value : 1,
        unitPrice: prices.length ? prices[0] : 0,
        total: prices.length > 1 ? prices[prices.length - 1] : prices[0] || 0,
      });
    });
    return lines;
  }

  function readZip(root) {
    if (!root || !root.querySelector) return "";
    var input = root.querySelector(
      '#postalCode, input[name="postalCode" i], input[name*="zip" i], input[id*="zip" i], input[name*="postal" i], input[id*="postal" i]'
    );
    return input ? input.value : "";
  }

  function optionContainer(input) {
    if (!input) return null;
    var label = input.id && d.querySelector('label[for="' + input.id.replace(/"/g, "") + '"]');
    return input.closest("tr") || input.closest("li") || input.closest("label") || label || input.parentElement;
  }

  function findRateOptions(root) {
    if (!root || !root.querySelectorAll) return [];
    var output = [];
    root.querySelectorAll('input[type="radio"], option').forEach(function (input) {
      var name = String(input.name || (input.parentElement && input.parentElement.name) || "");
      var container = input.tagName === "OPTION" ? input : optionContainer(input);
      var label = (container && container.textContent) || input.textContent || input.value || "";
      if (!/ship|deliver|freight|glove|pickup/i.test(name + " " + label)) return;
      output.push({ input: input, container: container, label: label });
    });
    return output;
  }

  function findMessageRows(root) {
    if (!root || !root.querySelectorAll) return [];
    var candidates = [];
    root.querySelectorAll("tr, li, div, p, span").forEach(function (el) {
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 200) return;
      if (!/free\s+shipping/i.test(text)) return;
      if (!/on\s+orders?\s+of|\$\s*\d/.test(text)) return;
      candidates.push(el);
    });
    return candidates.filter(function (el) {
      return !candidates.some(function (other) {
        return other !== el && el.contains(other);
      });
    });
  }

  function setRowVisible(el, visible) {
    if (!el) return;
    if (!visible) {
      if (!el.hasAttribute("data-mc-shipping-display")) {
        el.setAttribute("data-mc-shipping-display", el.style.display || "");
      }
      el.style.setProperty("display", "none", "important");
      el.setAttribute("data-mc-shipping-hidden", "1");
    } else if (el.getAttribute("data-mc-shipping-hidden") === "1") {
      el.style.display = el.getAttribute("data-mc-shipping-display") || "";
      el.removeAttribute("data-mc-shipping-hidden");
    }
  }

  function setOptionVisible(option, visible) {
    var input = option.input;
    var container = option.container;
    if (!input) return;

    if (input.tagName === "OPTION") {
      input.hidden = !visible;
      input.disabled = !visible;
      if (!visible && input.selected) input.selected = false;
      return;
    }

    input.disabled = !visible;
    if (!visible && input.checked) input.checked = false;
    if (container && container.style) {
      if (!visible) {
        if (!container.hasAttribute("data-mc-shipping-display")) {
          container.setAttribute("data-mc-shipping-display", container.style.display || "");
        }
        container.style.setProperty("display", "none", "important");
        container.setAttribute("data-mc-shipping-hidden", "1");
      } else if (container.getAttribute("data-mc-shipping-hidden") === "1") {
        container.style.display = container.getAttribute("data-mc-shipping-display") || "";
        container.removeAttribute("data-mc-shipping-hidden");
      }
    }
  }

  function fireChange(el) {
    try {
      el.dispatchEvent(new g.Event("change", { bubbles: true }));
    } catch (e) {
      try {
        var evt = d.createEvent("HTMLEvents");
        evt.initEvent("change", true, true);
        el.dispatchEvent(evt);
      } catch (e2) {}
    }
  }

  function selectRemainingAllowedRate(options) {
    var radioGroups = {};
    var selectGroups = {};

    options.forEach(function (option) {
      var input = option.input;
      if (input.tagName === "OPTION") {
        var selectEl = input.closest && input.closest("select");
        if (!selectEl) return;
        var skey = selectEl.name || selectEl.id || "select";
        selectGroups[skey] = selectGroups[skey] || { el: selectEl, opts: [] };
        selectGroups[skey].opts.push(option);
      } else if (input.type === "radio") {
        var rkey = input.name || "radio";
        radioGroups[rkey] = radioGroups[rkey] || [];
        radioGroups[rkey].push(option);
      }
    });

    Object.keys(radioGroups).forEach(function (key) {
      var opts = radioGroups[key];
      var visibleOpts = opts.filter(function (o) {
        return !o.input.disabled;
      });
      if (!visibleOpts.length) return;
      var alreadyChecked = visibleOpts.some(function (o) {
        return o.input.checked;
      });
      if (alreadyChecked) return;
      visibleOpts[0].input.checked = true;
      fireChange(visibleOpts[0].input);
    });

    Object.keys(selectGroups).forEach(function (key) {
      var group = selectGroups[key];
      var visibleOpts = group.opts.filter(function (o) {
        return !o.input.hidden;
      });
      if (!visibleOpts.length) return;
      var current = group.el.options[group.el.selectedIndex];
      var stillValid = current && visibleOpts.some(function (o) {
        return o.input === current;
      });
      if (stillValid) return;
      group.el.value = visibleOpts[0].input.value;
      fireChange(group.el);
    });
  }

  function applyPolicy() {
    if (!d || !d.body) return;
    var root = d.getElementById("content_area") || d.body;
    var lines = readCartLines(root);
    if (!lines.length) return;
    var summary = summarizeCart(lines);
    var zip = readZip(root);
    var options = findRateOptions(root);
    options.forEach(function (option) {
      setOptionVisible(option, isRateAllowed(option.label, summary, zip));
    });
    selectRemainingAllowedRate(options);
    findMessageRows(root).forEach(function (row) {
      setRowVisible(row, isRateAllowed(row.textContent, summary, zip));
    });
    d.documentElement.setAttribute("data-mc-shipping-policy", VERSION);
  }

  function boot() {
    if (!d || !d.body) return;
    var path = String(g.location && g.location.pathname || "").toLowerCase();
    if (!/shoppingcart|shopcart\.asp|\/cart\b|onepagecheckout|checkout/i.test(path)) return;
    applyPolicy();

    var root = d.getElementById("content_area") || d.body;
    var timer = null;
    if (typeof g.MutationObserver === "function") {
      new g.MutationObserver(function () {
        if (timer) g.clearTimeout(timer);
        timer = g.setTimeout(applyPolicy, 120);
      }).observe(root, { childList: true, subtree: true });
    }
    root.addEventListener("change", function (event) {
      if (/zip|postal|state|country/i.test(String(event.target && (event.target.name || event.target.id) || ""))) {
        g.setTimeout(applyPolicy, 0);
      }
    });
  }

  g.__MC_SHIPPING_RATE_POLICY__ = {
    version: VERSION,
    threshold: SARANONI_FREE_THRESHOLD,
    whiteGloveTiers: zipTierData,
    productFamily: productFamily,
    rateType: rateType,
    isDfwZip: isDfwZip,
    whiteGloveQuote: whiteGloveQuote,
    summarizeCart: summarizeCart,
    isRateAllowed: isRateAllowed,
    apply: applyPolicy,
  };

  if (!d) return;
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();
  g.addEventListener("load", applyPolicy);
})(window, document);
