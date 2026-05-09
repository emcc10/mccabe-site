/**
 * Sectional PDP: configuration diagrams, native select sync, product summary.
 * Cache: 20260509final1
 */
(function () {
  "use strict";

  var IMG_V = "20260509final1";
  var state = { cfgByCode: {} };

  function normalizeCode(code) {
    return String(code || "")
      .replace(/\//g, "-")
      .trim()
      .toLowerCase();
  }

  function findConfigurationSelect() {
    var selects = Array.from(document.querySelectorAll("select"));

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

      return /choose configuration|configuration/i.test(rowText);
    });
  }

  function hideConfigurationRow() {
    var configSelect = findConfigurationSelect();
    if (!configSelect) {
      console.warn("No native configuration select found.");
      return;
    }
    if (configSelect.dataset.mtlRowHidden === "1") return;
    var row = configSelect.closest("tr") || configSelect.parentElement;
    if (row) {
      row.style.display = "none";
    }
    configSelect.dataset.mtlRowHidden = "1";
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

  function selectNativeConfiguration(code) {
    var sel = findConfigurationSelect();
    if (!sel) {
      console.warn("No native configuration select found.");
      return false;
    }

    var normalizedCode = normalizeCode(code);

    var option = Array.from(sel.options).find(function (opt) {
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

    if (!option) {
      console.warn("No matching Volusion option for configuration", code, sel);
      return false;
    }

    sel.value = option.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    if (typeof jQuery !== "undefined") {
      jQuery(sel).trigger("change");
    }
    console.log("Selected native configuration", code, sel.value);
    return true;
  }

  function readDisplayedPrice() {
    var el =
      document.querySelector("#priceWithOptions") || document.querySelector('[itemprop="price"]');
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
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Estimated Product Price</span><span class="mtl-summary-value" id="mtl-sum-price">—</span></div>';
    }
    if (section && section.parentNode) {
      try {
        section.parentNode.insertBefore(sum, section.nextSibling);
      } catch (eIns) {}
    }
    return sum;
  }

  function updateProductSummary() {
    var sum = document.getElementById("mtl-product-summary");
    if (!sum) return;

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
    var adj = cfg ? formatAdjustment(cfg.priceDiff) : "$0";
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

  function selectConfigurationCard(code) {
    var cards = Array.from(document.querySelectorAll("#mtl-sectional-configurations .mtl-sectional-card"));
    cards.forEach(function (card) {
      card.classList.remove("is-selected");
    });

    var normalizedCode = normalizeCode(code);
    var selectedCard = cards.find(function (card) {
      var cardCode = normalizeCode(card.getAttribute("data-config-code") || "");
      return cardCode === normalizedCode;
    });
    if (selectedCard) {
      selectedCard.classList.add("is-selected");
    }

    window.__mtlSectionalSelectedConfig = code;
    selectNativeConfiguration(code);
    setTimeout(updateProductSummary, 250);
    setTimeout(updateProductSummary, 800);
  }

  function moveLeatherAboveConfigurations(section) {
    if (!section || !section.parentNode) return;
    var parent = section.parentNode;

    var mc = document.getElementById("mc-inline-config");
    if (mc && mc.parentNode === parent) {
      parent.insertBefore(mc, section);
    }

    var wmHi = document.querySelector(".wm-leather-summary");
    var wmWrap = wmHi && wmHi.parentElement;
    var wmo = document.getElementById("wmOpen");
    if (wmWrap && wmo && wmWrap.contains(wmo) && wmWrap.parentNode) {
      try {
        parent.insertBefore(wmWrap, section);
      } catch (eMv) {
        console.warn("Could not move leather UI wrapper:", eMv);
      }
    }
  }

  function wireSectionClicks() {
    var sec = document.getElementById("mtl-sectional-configurations");
    if (!sec || sec.dataset.mtlClickWired === "1") return;
    sec.addEventListener("click", function (e) {
      var card = e.target.closest(".mtl-sectional-card");
      if (!card || !sec.contains(card)) return;
      var c = card.getAttribute("data-config-code");
      if (c) selectConfigurationCard(c);
    });
    sec.dataset.mtlClickWired = "1";
  }

  function ensureObservers() {
    var configSel = findConfigurationSelect();
    if (configSel && configSel.dataset.mtlObsChange !== "1") {
      configSel.addEventListener("change", function () {
        window.setTimeout(updateProductSummary, 0);
      });
      configSel.dataset.mtlObsChange = "1";
    }

    var priceEl =
      document.querySelector("#priceWithOptions") || document.querySelector('[itemprop="price"]');
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

  function renderSectionalPdp() {
    var allConfigs = window.MTL_SECTIONAL_CONFIGS || {};
    console.log("sectional configs", allConfigs);

    var pageText = [
      location.pathname,
      document.title,
      document.querySelector("h1") ? document.querySelector("h1").textContent : "",
      document.body ? document.body.innerText.slice(0, 3000) : "",
    ]
      .join(" ")
      .toLowerCase();

    var productKey = Object.keys(allConfigs).find(function (key) {
      return pageText.indexOf(key.toLowerCase()) !== -1;
    });

    var matchedConfigs = productKey ? allConfigs[productKey] : [];

    console.log("sectional productKey", productKey);
    console.log("sectional matchedConfigs", matchedConfigs);

    if (!Array.isArray(matchedConfigs) || !matchedConfigs.length) {
      console.warn("No matched sectional configs.");
      return;
    }

    var secExistingEarly = document.getElementById("mtl-sectional-configurations");
    if (secExistingEarly && secExistingEarly.dataset.mtlFinalInit === "1") {
      moveLeatherAboveConfigurations(secExistingEarly);
      ensureProductSummary(secExistingEarly);
      hideConfigurationRow();
      wireSectionClicks();
      ensureObservers();
      updateProductSummary();
      var selLog = findConfigurationSelect();
      console.log("sectional config select", selLog);
      console.log("selected sectional config", window.__mtlSectionalSelectedConfig);
      console.log("native config select value", selLog && selLog.value);
      return;
    }

    var configSelect = findConfigurationSelect();
    console.log("sectional config select", configSelect);
    if (!configSelect) {
      console.warn("sectional renderer waiting for native configuration select");
      return;
    }

    var filtered = matchedConfigs.filter(function (c) {
      return c && c.code && volusionHasOption(configSelect, c.code);
    });
    if (!filtered.length) {
      console.warn("No sectional configs match Volusion options.", productKey);
      return;
    }

    state.cfgByCode = {};
    filtered.forEach(function (c) {
      state.cfgByCode[c.code] = c;
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

    filtered.forEach(function (cfg) {
      var card = document.createElement("div");
      card.className = "mtl-sectional-card";
      card.setAttribute("data-config-code", cfg.code || "");

      var img = document.createElement("img");
      img.className = "mtl-sectional-image";
      var src = String(cfg.image || "");
      img.src = src.indexOf("?") === -1 ? src + "?v=" + IMG_V : src + "&v=" + IMG_V;
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

    ensureProductSummary(section);
    moveLeatherAboveConfigurations(section);
    hideConfigurationRow();
    wireSectionClicks();
    ensureObservers();

    var baseConfig =
      filtered.find(function (c) {
        return c.base === true;
      }) || filtered[0];

    if (baseConfig && baseConfig.code) {
      window.__mtlSectionalSelectedConfig = baseConfig.code;
      selectConfigurationCard(baseConfig.code);
    }

    console.log("selected sectional config", window.__mtlSectionalSelectedConfig);
    console.log(
      "native config select value",
      findConfigurationSelect() && findConfigurationSelect().value
    );

    section.dataset.mtlFinalInit = "1";
    console.log("sectional diagrams inserted:", filtered.length);
  }

  function runRender() {
    try {
      renderSectionalPdp();
    } catch (err) {
      console.error("Sectional renderer failed:", err);
    }
  }

  window.findConfigurationSelect = findConfigurationSelect;

  console.log("mtl-sectional-renderer loaded 20260509final1");

  function boot() {
    runRender();
    setTimeout(runRender, 400);
    setTimeout(runRender, 1200);
    setTimeout(runRender, 2800);
  }

  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", runRender);
})();
