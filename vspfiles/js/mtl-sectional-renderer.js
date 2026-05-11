/**
 * Sectional PDP: configuration diagrams, native select sync, product summary.
 * Cache: 20260512sectional
 */
(function () {
  "use strict";

  var IMG_V = "20260512sectional";
  var SECTIONAL_DBG = /(?:[?&])mtlSectionalDebug=1(?:&|$)/.test(String(location.search || ""));
  /** When true, do not collapse the Volusion Choose Configuration row (user opened "More configurations"). */
  var nativeConfigRowUserExpanded = false;
  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220"><rect fill="#f2f2f2" width="360" height="220"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="13">Configuration diagram</text></svg>'
    );

  var state = { cfgByCode: {} };

  function sectionalLog() {
    if (!SECTIONAL_DBG) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[mtl-sectional]");
    console.log.apply(console, args);
  }

  function normalizeCode(code) {
    return String(code || "")
      .replace(/\//g, "-")
      .trim()
      .toLowerCase();
  }

  function normalizeForMatch(text) {
    return String(text || "")
      .replace(/\//g, "-")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function isPlaceholderConfigOption(opt) {
    var t = String(opt.textContent || "").trim();
    var v = String(opt.value || "").trim();
    if (!t || !v) return true;
    if (/choose|select|please select|^--|^-$/i.test(t)) return true;
    return false;
  }

  function stripPricingSuffix(display) {
    return String(display || "").replace(/\s*\([^)]*\)\s*$/g, "").trim();
  }

  function extractPrimaryCode(display) {
    var cleaned = stripPricingSuffix(display);
    var digitsRun = cleaned.match(/\d(?:[\s\/-]*\d)+(?:[\s\/-]*\d)*/);
    if (digitsRun)
      return String(digitsRun[0]).replace(/\s+/g, "").replace(/\//g, "-");

    digitsRun = cleaned.match(/\d{5,}/);
    if (digitsRun) return digitsRun[0];

    cleaned = normalizeCode(stripPricingSuffix(display).split(/\s+/)[0]);
    return cleaned || normalizeCode(display);
  }

  function findConfigurationSelect() {
    var root =
      document.querySelector("#v65-product-parent #options_table, #v65-product-parent table[id*='options_table']") ||
      document.querySelector("#options_table, table[id*='options_table']");
    var selects = root
      ? Array.from(root.querySelectorAll("select"))
      : Array.from(document.querySelectorAll("#v65-product-parent select, #options_table select"));

    return selects.find(function (sel) {
      if (sel.classList && sel.classList.contains("mc-native-leather")) return false;
      if (sel.closest && sel.closest(".mc-native-leather")) return false;

      var rowText = "";
      var tr = sel.closest("tr");
      var td = sel.closest("td");
      var parent = sel.parentElement;

      if (tr) rowText += " " + tr.innerText;
      if (td) rowText += " " + td.innerText;
      if (parent) rowText += " " + parent.innerText;

      return /choose configuration|^configuration\b|choose\s+seat/i.test(rowText);
    });
  }

  function hideConfigurationRow() {
    if (nativeConfigRowUserExpanded) return;
    var configSelect = findConfigurationSelect();
    if (!configSelect) {
      console.warn("No native configuration select found.");
      return;
    }
    if (configSelect.dataset.mtlRowHidden === "1") return;
    var row = configSelect.closest("tr") || configSelect.parentElement;
    if (row) {
      if (document.documentElement.classList.contains("is-sectional-product")) {
        row.style.setProperty("display", "none", "important");
        row.style.setProperty("visibility", "hidden", "important");
      } else {
        row.style.display = "none";
      }
    }
    configSelect.dataset.mtlRowHidden = "1";
  }

  function revealNativeConfigurationRow() {
    var configSelect = findConfigurationSelect();
    if (!configSelect) return;
    var row = configSelect.closest("tr") || configSelect.parentElement;
    if (row) {
      row.style.removeProperty("display");
      row.style.removeProperty("visibility");
    }
    configSelect.dataset.mtlRowHidden = "0";
    try {
      configSelect.focus();
    } catch (eF) {}
  }

  function scheduleHideConfigurationRow() {
    hideConfigurationRow();
    [500, 1500, 3000].forEach(function (ms) {
      setTimeout(hideConfigurationRow, ms);
    });
  }

  function findLeatherBlock() {
    var row = document.getElementById("mcLeatherRow");
    if (row) return row;
    var hi = document.querySelector(".wm-leather-summary");
    if (hi && hi.parentElement) return hi.parentElement;
    return document.getElementById("mc-inline-config");
  }

  function moveLeatherAboveConfigurations(section) {
    if (!section || !section.parentNode) return;
    var parent = section.parentNode;
    var block = findLeatherBlock();
    if (!block || !block.parentNode) return;
    if (block === section) return;
    try {
      parent.insertBefore(block, section);
    } catch (eMv) {
      console.warn("Could not move leather block above configurations:", eMv);
    }
  }

  function scheduleMoveLeatherAboveConfigurations(section) {
    if (!section) return;
    moveLeatherAboveConfigurations(section);
    [500, 1500, 3000].forEach(function (ms) {
      setTimeout(function () {
        moveLeatherAboveConfigurations(section);
      }, ms);
    });
  }

  function bindLeatherTrigger() {
    function bindEl(el) {
      if (!el || el.dataset.mtlLeatherBound === "1") return;
      el.addEventListener(
        "click",
        function (ev) {
          var w = document.getElementById("wmOpen");
          if (w) {
            ev.preventDefault();
            w.click();
          }
        },
        false
      );
      el.dataset.mtlLeatherBound = "1";
    }
    bindEl(document.getElementById("mcLeatherBtn"));
    bindEl(document.getElementById("mcLeatherHeader"));
  }

  function scheduleBindLeatherTrigger() {
    bindLeatherTrigger();
    [500, 1500, 3000].forEach(function (ms) {
      setTimeout(bindLeatherTrigger, ms);
    });
  }

  function findInsertTarget() {
    return (
      document.querySelector("#options_table") ||
      document.querySelector("#v65-product-parent") ||
      document.querySelector("#content_area") ||
      document.body
    );
  }

  function volusionHasOption(sel, code) {
    if (!sel || !code) return false;
    var normalizedCode = normalizeCode(code);
    return Array.from(sel.options).some(function (opt) {
      var text = String(opt.textContent || "")
        .replace(/\//g, "-")
        .trim()
        .toLowerCase();
      var value = String(opt.value || "")
        .replace(/\//g, "-")
        .trim()
        .toLowerCase();
      return text.indexOf(normalizedCode) !== -1 || value.indexOf(normalizedCode) !== -1;
    });
  }

  function optionMatchesCode(opt, code) {
    if (!opt || !code) return false;
    var n = normalizeCode(code);
    var text = normalizeForMatch(stripPricingSuffix(opt.textContent || ""));
    var value = normalizeForMatch(opt.value || "");
    if (value && (value === n || value.indexOf(n) !== -1)) return true;
    if (text && (text === n || text.indexOf(n) !== -1)) return true;
    var parts = n.split(/[-/]+/).filter(Boolean);
    if (parts.length > 1) {
      return parts.every(function (p) {
        return !p || text.indexOf(p) !== -1 || value.indexOf(p) !== -1;
      });
    }
    return false;
  }

  function selectNativeConfiguration(preferredValue, codeHint) {
    var sel = findConfigurationSelect();
    if (!sel) {
      console.warn("No native configuration select found.");
      return false;
    }

    var opts = Array.from(sel.options);
    var opt = null;

    if (preferredValue != null && String(preferredValue) !== "") {
      opt = opts.find(function (o) {
        return String(o.value) === String(preferredValue);
      });
    }

    if (!opt && codeHint) {
      var normalizedCode = normalizeCode(codeHint);
      opt = opts.find(function (o) {
        return optionMatchesCode(o, normalizedCode);
      });
    }

    if (!opt && codeHint) {
      opt = opts.find(function (o) {
        var text = String(o.textContent || "")
          .replace(/\//g, "-")
          .trim()
          .toLowerCase();
        var value = String(o.value || "")
          .replace(/\//g, "-")
          .trim()
          .toLowerCase();
        return text.indexOf(normalizedCode) !== -1 || value.indexOf(normalizedCode) !== -1;
      });
    }

    if (!opt) {
      console.warn("No matching Volusion option for configuration", codeHint, preferredValue, sel);
      return false;
    }

    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    if (typeof jQuery !== "undefined") {
      jQuery(sel).trigger("change");
    }
    sectionalLog("Selected native configuration", codeHint, "value=", sel.value);
    return true;
  }

  function readDisplayedPrice() {
    var selectors = [
      "#v65-product-parent #priceWithOptions",
      "#content_area #priceWithOptions",
      "#priceWithOptions",
      "#v65-product-parent #priceWithOptionsNoTax",
      "#content_area #priceWithOptionsNoTax",
      ".colors_pricebox #priceWithOptions",
      "font#priceWithOptions",
      ".v65-product-price",
      ".product_productprice",
      ".option_pricing",
      '[itemprop="price"]',
    ];
    var i;
    var el = null;
    for (i = 0; i < selectors.length; i++) {
      el = document.querySelector(selectors[i]);
      if (el && String(el.textContent || "").replace(/\s+/g, "").length) break;
      el = null;
    }
    if (!el) return "";
    return String(el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatAdjustment(diff) {
    var n = Number(diff);
    if (!n || isNaN(n) || n === 0) return "$0";
    return "+$" + n;
  }

  function getSelectedConfigurationAdjustment() {
    var sel = findConfigurationSelect();
    if (!sel || sel.selectedIndex < 0) return null;
    var text = String((sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].textContent) || "").trim();
    var paren = text.match(/\(\s*\+?\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\)/i);
    if (paren) return parseFloat(paren[1].replace(/,/g, ""));
    var plus = text.match(/\+\s*\$?\s*([\d,]+(?:\.\d{2})?)/);
    if (plus) return parseFloat(plus[1].replace(/,/g, ""));
    return null;
  }

  function refreshProductPriceLabel() {
    var rows = document.querySelectorAll("#mtl-product-summary .mtl-summary-row");
    var i;
    for (i = 0; i < rows.length; i++) {
      var lab = rows[i].querySelector(".mtl-summary-label");
      if (!lab) continue;
      var t = String(lab.textContent || "");
      if (/estimated/i.test(t) && /price/i.test(t)) {
        lab.textContent = "Product Price";
        break;
      }
    }
  }

  function ensureProductSummary(section) {
    var sum = document.getElementById("mtl-product-summary");
    if (!sum) {
      sum = document.createElement("div");
      sum.id = "mtl-product-summary";
      sum.innerHTML =
        '<h3 class="mtl-summary-heading">Product Summary</h3>' +
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Selected Leather</span><span class="mtl-summary-value" id="mtl-sum-leather">Not selected</span></div>' +
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Selected Configuration</span><span class="mtl-summary-value" id="mtl-sum-config">—</span></div>' +
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Configuration Price Adjustment</span><span class="mtl-summary-value" id="mtl-sum-adj">$0</span></div>' +
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Product Price</span><span class="mtl-summary-value" id="mtl-sum-price">—</span></div>';
    }
    if (section && section.parentNode) {
      try {
        section.parentNode.insertBefore(sum, section.nextSibling);
      } catch (eIns) {}
    }
    refreshProductPriceLabel();
    return sum;
  }

  function updateProductSummary() {
    var sum = document.getElementById("mtl-product-summary");
    if (!sum) return;
    refreshProductPriceLabel();

    var wm = document.getElementById("wmSummary");
    var mcL = document.getElementById("mcLeatherSummary");
    var leatherTxt = "";
    if (mcL && String(mcL.textContent || "").trim())
      leatherTxt = String(mcL.textContent).trim();
    else if (wm && String(wm.textContent || "").trim()) leatherTxt = String(wm.textContent).trim();
    if (!leatherTxt) leatherTxt = "Not selected";

    var code = window.__mtlSectionalSelectedConfig;
    var cfg = code ? state.cfgByCode[code] : null;
    var configLabel = cfg ? cfg.label || cfg.code || code : code || "—";

    var adjParsed = getSelectedConfigurationAdjustment();
    var adjNum = adjParsed != null && !isNaN(adjParsed) ? adjParsed : cfg && cfg.priceDiff != null ? Number(cfg.priceDiff) : 0;
    if (isNaN(adjNum)) adjNum = 0;
    var adj = formatAdjustment(adjNum);

    var price = readDisplayedPrice();

    var elL = document.getElementById("mtl-sum-leather");
    var elC = document.getElementById("mtl-sum-config");
    var elA = document.getElementById("mtl-sum-adj");
    var elP = document.getElementById("mtl-sum-price");
    if (elL) elL.textContent = leatherTxt;
    if (elC) elC.textContent = configLabel;
    if (elA) elA.textContent = adj;
    if (elP) elP.textContent = price || "—";
  }

  function scheduleProductSummaryAfterConfigChange() {
    [250, 800, 1500].forEach(function (ms) {
      setTimeout(updateProductSummary, ms);
    });
  }

  function syncCardsSelectionHighlight() {
    var sec = document.getElementById("mtl-sectional-configurations");
    if (!sec) return;
    var sel = findConfigurationSelect();
    if (!sel) return;
    var val = String(sel.value || "");
    var cards = Array.from(sec.querySelectorAll(".mtl-sectional-card"));
    cards.forEach(function (card) {
      card.classList.remove("is-selected");
      var v = card.getAttribute("data-config-value");
      if (v != null && String(v) === val) card.classList.add("is-selected");
    });
  }

  function selectConfigurationCard(code, preferredNativeValue) {
    var cards = Array.from(document.querySelectorAll("#mtl-sectional-configurations .mtl-sectional-card"));
    cards.forEach(function (card) {
      card.classList.remove("is-selected");
    });

    var normalizedCode = normalizeCode(code);
    var selectedCard =
      preferredNativeValue != null && cards.find(function (c) {
        return String(c.getAttribute("data-config-value") || "") === String(preferredNativeValue);
      });
    if (!selectedCard) {
      selectedCard = cards.find(function (card) {
        var cardCode = normalizeCode(card.getAttribute("data-config-code") || "");
        return cardCode === normalizedCode;
      });
    }
    if (selectedCard) {
      selectedCard.classList.add("is-selected");
    }

    window.__mtlSectionalSelectedConfig = code;
    window.__mtlSectionalPreferredNativeValue = preferredNativeValue;
    selectNativeConfiguration(preferredNativeValue, code);
    scheduleProductSummaryAfterConfigChange();
    setTimeout(syncCardsSelectionHighlight, 50);
  }

  function bindConfigurationCardClicks() {
    var sec = document.getElementById("mtl-sectional-configurations");
    if (!sec) return;
    var cards = sec.querySelectorAll(".mtl-sectional-card");
    Array.prototype.forEach.call(cards, function (card) {
      if (card.dataset.mtlConfigBound === "1") return;
      card.addEventListener("click", function () {
        var c = card.getAttribute("data-config-code") || "";
        var v = card.getAttribute("data-config-value");
        if (v !== null) selectConfigurationCard(c, v);
        else selectConfigurationCard(c);
      });
      card.dataset.mtlConfigBound = "1";
    });
  }

  function ensureObservers() {
    var configSel = findConfigurationSelect();
    if (configSel && configSel.dataset.mtlObsChange !== "1") {
      configSel.addEventListener("change", function () {
        var opt = configSel.selectedOptions && configSel.selectedOptions[0];
        if (opt) {
          window.__mtlSectionalPreferredNativeValue = opt.value;
          window.__mtlSectionalSelectedConfig = extractPrimaryCode(opt.textContent || "");
        }
        window.setTimeout(function () {
          syncCardsSelectionHighlight();
          updateProductSummary();
        }, 0);
        scheduleProductSummaryAfterConfigChange();
      });
      configSel.dataset.mtlObsChange = "1";
    }

    var priceEl =
      document.querySelector("#v65-product-parent #priceWithOptions, #content_area #priceWithOptions, #priceWithOptions") ||
      document.querySelector("#v65-product-parent #priceWithOptionsNoTax") ||
      document.querySelector(".v65-product-price") ||
      document.querySelector('[itemprop="price"]');
    if (priceEl && priceEl.dataset.mtlPriceObs !== "1") {
      var obs = new MutationObserver(updateProductSummary);
      obs.observe(priceEl, { childList: true, characterData: true, subtree: true });
      priceEl.dataset.mtlPriceObs = "1";
    }

    var wm = document.getElementById("wmSummary");
    if (wm && wm.dataset.mtlLeatherObs !== "1") {
      new MutationObserver(updateProductSummary).observe(wm, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      wm.dataset.mtlLeatherObs = "1";
    }

    var mcLeather = document.getElementById("mcLeatherSummary");
    if (mcLeather && mcLeather.dataset.mtlLeatherObs !== "1") {
      new MutationObserver(updateProductSummary).observe(mcLeather, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      mcLeather.dataset.mtlLeatherObs = "1";
    }
  }

  function ensureMoreConfigurationsToggle(section) {
    if (!section || section.querySelector("#mtl-sectional-more-native")) return;
    var wrap = document.createElement("div");
    wrap.id = "mtl-sectional-more-native";
    wrap.className = "mtl-sectional-more-native";
    wrap.style.cssText = "margin-top:12px;font-size:13px;";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "mtl-sectional-toggle-native-row";
    btn.style.cssText =
      "background:transparent;border:0;padding:0;cursor:pointer;color:#333;text-decoration:underline;font:inherit;";
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "More configurations (show native menu)";
    btn.addEventListener("click", function () {
      var exp = btn.getAttribute("aria-expanded") === "true";
      if (exp) {
        nativeConfigRowUserExpanded = false;
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = "More configurations (show native menu)";
        scheduleHideConfigurationRow();
      } else {
        nativeConfigRowUserExpanded = true;
        btn.setAttribute("aria-expanded", "true");
        btn.textContent = "Hide native configuration menu";
        revealNativeConfigurationRow();
      }
    });
    wrap.appendChild(btn);
    var inner = section.querySelector(".mtl-sectional-inner");
    if (inner) inner.appendChild(wrap);
    else section.appendChild(wrap);
  }

  function mergeNativeOptionsWithJson(configSelect, jsonCfgs) {
    var jsonList = Array.isArray(jsonCfgs) ? jsonCfgs.slice() : [];
    var usedJson = {};
    var merged = [];

    var byNormKey = {};
    jsonList.forEach(function (c) {
      if (!c || !c.code) return;
      var k = normalizeCode(c.code);
      if (!byNormKey[k]) byNormKey[k] = c;
    });

    Array.from(configSelect.options).forEach(function (opt) {
      if (isPlaceholderConfigOption(opt)) return;

      var rawText = String(opt.textContent || "").trim();
      var primary = extractPrimaryCode(rawText);
      var normKey = normalizeCode(primary);
      var jsonHit = byNormKey[normKey];
      if (!jsonHit) {
        jsonHit = jsonList.find(function (c) {
          if (!c || !c.code || usedJson[c.code]) return false;
          return volusionHasOption({ options: [opt] }, c.code) || optionMatchesCode(opt, c.code);
        });
      }
      if (jsonHit) usedJson[jsonHit.code] = true;

      var label = jsonHit && jsonHit.label ? jsonHit.label : stripPricingSuffix(rawText) || primary;
      var desc = jsonHit && jsonHit.description ? jsonHit.description : "";
      var image = jsonHit && jsonHit.image ? String(jsonHit.image) : "";
      var priceDiff = jsonHit && jsonHit.priceDiff != null ? jsonHit.priceDiff : null;

      merged.push({
        code: (jsonHit && jsonHit.code) || primary,
        nativeValue: opt.value,
        label: label,
        description: desc,
        image: image,
        priceDiff: priceDiff,
        base: !!(jsonHit && jsonHit.base),
      });
    });

    return merged;
  }

  function finalizeSectionalUi(section) {
    try {
      document.documentElement.classList.add("has-sectional-config-cards");
    } catch (eCls) {}
    ensureProductSummary(section);
    scheduleMoveLeatherAboveConfigurations(section);
    ensureMoreConfigurationsToggle(section);
    scheduleHideConfigurationRow();
    scheduleBindLeatherTrigger();
    bindConfigurationCardClicks();
    ensureObservers();
    syncCardsSelectionHighlight();
    updateProductSummary();
  }

  function renderSectionalPdp() {
    var allConfigs = window.MTL_SECTIONAL_CONFIGS || {};
    sectionalLog("sectional configs keys", Object.keys(allConfigs));

    var pageText = [
      location.pathname,
      document.title,
      document.querySelector("h1") ? document.querySelector("h1").textContent : "",
      document.body ? document.body.innerText.slice(0, 3000) : "",
    ]
      .join(" ")
      .toLowerCase();

    var pcInput = document.querySelector('input[name="ProductCode"], input[name="productcode"]');
    var pcVal = pcInput ? String(pcInput.value || "").trim() : "";
    var pcLower = pcVal.toLowerCase();

    var keysList = Object.keys(allConfigs);
    var productKey = keysList.find(function (key) {
      return pageText.indexOf(key.toLowerCase()) !== -1;
    });
    if (!productKey && pcLower) {
      productKey = keysList.find(function (key) {
        return pcLower.indexOf(key.toLowerCase()) !== -1;
      });
    }

    var jsonFromKey = productKey ? allConfigs[productKey] : [];
    if (!Array.isArray(jsonFromKey)) jsonFromKey = [];

    sectionalLog("sectional productKey", productKey, "json count", jsonFromKey.length);

    var secExistingEarly = document.getElementById("mtl-sectional-configurations");
    if (secExistingEarly && secExistingEarly.dataset.mtlFinalInit === "1") {
      finalizeSectionalUi(secExistingEarly);
      var selLog = findConfigurationSelect();
      sectionalLog("sectional config select", selLog);
      sectionalLog("selected sectional config", window.__mtlSectionalSelectedConfig);
      sectionalLog("native config select value", selLog && selLog.value);
      return;
    }

    var configSelect = findConfigurationSelect();
    sectionalLog("sectional config select", configSelect);
    if (!configSelect) {
      console.warn("sectional renderer waiting for native configuration select");
      return;
    }

    var merged = mergeNativeOptionsWithJson(configSelect, jsonFromKey);
    if (!merged.length) {
      console.warn("No Volusion configuration options to display as cards.", productKey);
      return;
    }

    state.cfgByCode = {};
    merged.forEach(function (c) {
      if (c && c.code) state.cfgByCode[normalizeCode(c.code)] = c;
    });

    var existing = document.getElementById("mtl-sectional-configurations");
    var section = existing || document.createElement("section");
    section.id = "mtl-sectional-configurations";
    section.className = "mtl-sectional-configurations";

    var inner = document.createElement("div");
    inner.className = "mtl-sectional-inner";
    var h = document.createElement("h3");
    h.className = "mtl-sectional-heading";
    h.textContent = "Popular Configurations";
    var grid = document.createElement("div");
    grid.className = "mtl-sectional-grid";

    merged.forEach(function (cfg) {
      var card = document.createElement("div");
      card.className = "mtl-sectional-card";
      card.setAttribute("data-config-code", cfg.code || "");
      card.setAttribute("data-config-value", cfg.nativeValue != null ? String(cfg.nativeValue) : "");

      var img = document.createElement("img");
      img.className = "mtl-sectional-image";
      var src = String(cfg.image || "").trim();
      if (!src) {
        img.src = PLACEHOLDER_SVG;
      } else {
        img.src = src.indexOf("?") === -1 ? src + "?v=" + IMG_V : src + "&v=" + IMG_V;
      }
      img.alt = cfg.label || cfg.code || "Configuration";

      var tit = document.createElement("div");
      tit.className = "mtl-sectional-title";
      tit.textContent = cfg.label || cfg.code || "";

      var desc = document.createElement("div");
      desc.className = "mtl-sectional-desc";
      desc.textContent = cfg.description || "";

      card.appendChild(img);
      card.appendChild(tit);
      card.appendChild(desc);
      grid.appendChild(card);
    });

    inner.appendChild(h);
    inner.appendChild(grid);
    section.innerHTML = "";
    section.appendChild(inner);

    var target = findInsertTarget();
    if (!target) {
      console.error("No sectional insert target found.");
      return;
    }

    if (!existing || !target.contains(section)) {
      target.insertAdjacentElement("afterend", section);
    }

    finalizeSectionalUi(section);

    var baseConfig =
      merged.find(function (c) {
        return c.base === true;
      }) || merged[0];

    if (baseConfig) {
      selectConfigurationCard(baseConfig.code, baseConfig.nativeValue);
    }

    sectionalLog("selected sectional config", window.__mtlSectionalSelectedConfig);
    sectionalLog("native config select value", findConfigurationSelect() && findConfigurationSelect().value);

    section.dataset.mtlFinalInit = "1";
    sectionalLog("sectional diagram cards inserted:", merged.length);
  }

  function runRender() {
    try {
      renderSectionalPdp();
    } catch (err) {
      console.error("Sectional renderer failed:", err);
    }
  }

  window.findConfigurationSelect = findConfigurationSelect;

  console.log("mtl-sectional-renderer loaded 20260512sectional");

  function boot() {
    runRender();
    scheduleBindLeatherTrigger();
    setTimeout(runRender, 400);
    setTimeout(runRender, 1200);
    setTimeout(runRender, 2800);
  }

  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", runRender);
})();
