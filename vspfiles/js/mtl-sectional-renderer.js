(function () {
  console.log("mtl-sectional-renderer loaded 20260509f");

  var IMG_BUST = "20260509f";

  var state = {
    cfgByCode: {},
    currentCode: null,
  };

  function getConfigsObject() {
    return window.MTL_SECTIONAL_CONFIGS || {};
  }

  function getPageText() {
    var h1 = document.querySelector("h1");
    return [
      location.pathname,
      document.title,
      h1 ? h1.textContent : "",
      document.body ? document.body.innerText.slice(0, 3000) : "",
    ]
      .join(" ")
      .toLowerCase();
  }

  function getProductKey(configs) {
    var pageText = getPageText();

    return Object.keys(configs).find(function (key) {
      return pageText.indexOf(key.toLowerCase()) !== -1;
    });
  }

  function normalizeImage(src) {
    if (!src) return "";
    if (src.indexOf("http") === 0) return src;
    if (src.indexOf("/") === 0) return src;
    return "/v/vspfiles/sectional-diagrams/" + src;
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

  function hideNativeConfigurationRow(configSelect) {
    if (!configSelect) return;
    if (configSelect.dataset.mtlConfigRowHidden === "1") return;
    var row =
      configSelect.closest("tr") ||
      configSelect.closest(".v65-productdetail-options") ||
      configSelect.parentElement;
    if (row) row.style.display = "none";
    configSelect.dataset.mtlConfigRowHidden = "1";
  }

  function normalizeCode(code) {
    return String(code || "")
      .replace(/\//g, "-")
      .trim()
      .toLowerCase();
  }

  function selectNativeConfiguration(code) {
    var sel = findConfigurationSelect();
    if (!sel) {
      console.warn("No native configuration select found");
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

    return true;
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

  function readDisplayedPrice() {
    var el =
      document.querySelector("#priceWithOptions") || document.querySelector('[itemprop="price"]');
    if (!el) return "";
    return String(el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatPriceAdjustment(diff) {
    var n = Number(diff);
    if (!n || isNaN(n) || n === 0) return "$0";
    return "+$" + n;
  }

  function ensureProductSummary() {
    var sum = document.getElementById("mtl-product-summary");
    if (sum) return sum;
    sum = document.createElement("div");
    sum.id = "mtl-product-summary";
    sum.innerHTML =
      '<h3 class="mtl-summary-heading">Product Summary</h3>' +
      '<div class="mtl-summary-row"><span class="mtl-summary-label">Selected Leather</span><span class="mtl-summary-value" id="mtl-sum-leather">Not selected</span></div>' +
      '<div class="mtl-summary-row"><span class="mtl-summary-label">Selected Configuration</span><span class="mtl-summary-value" id="mtl-sum-config">—</span></div>' +
      '<div class="mtl-summary-row"><span class="mtl-summary-label">Configuration Price Adjustment</span><span class="mtl-summary-value" id="mtl-sum-adj">$0</span></div>' +
      '<div class="mtl-summary-row"><span class="mtl-summary-label">Estimated Product Price</span><span class="mtl-summary-value" id="mtl-sum-price">—</span></div>';
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

    var cfg = state.cfgByCode[state.currentCode];
    var configLabel = cfg ? cfg.label || cfg.code || state.currentCode : state.currentCode || "—";

    var adj = cfg ? formatPriceAdjustment(cfg.priceDiff) : "$0";

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

  function selectConfigCard(section, code) {
    if (!section) return;
    var ok = selectNativeConfiguration(code);
    if (!ok) return;

    var cards = section.querySelectorAll(".mtl-sectional-card");
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove("is-selected");
    }
    var normalized = normalizeCode(code);
    for (var j = 0; j < cards.length; j++) {
      var c = cards[j];
      var cc = c.getAttribute("data-config-code");
      if (cc && normalizeCode(cc) === normalized) {
        c.classList.add("is-selected");
        break;
      }
    }
    state.currentCode = code;
    updateProductSummary();
  }

  function placeAfterLeather(section, summary) {
    var leather = document.getElementById("mcLeatherRow");
    var parent = leather && leather.parentElement;
    if (parent) {
      parent.insertBefore(section, leather.nextSibling);
      parent.insertBefore(summary, section.nextSibling);
      return;
    }
    var target =
      document.querySelector("#mc-inline-config") ||
      document.querySelector("#options_table") ||
      document.querySelector("#v65-product-parent") ||
      document.body;
    if (!target.contains(section)) {
      target.insertAdjacentElement("afterend", section);
    }
    if (!target.contains(summary)) {
      section.insertAdjacentElement("afterend", summary);
    }
  }

  function ensureSummaryObservers() {
    var priceEl =
      document.querySelector("#priceWithOptions") || document.querySelector('[itemprop="price"]');
    if (priceEl && priceEl.dataset.mtlPriceObs !== "1") {
      var obs = new MutationObserver(function () {
        updateProductSummary();
      });
      obs.observe(priceEl, { childList: true, characterData: true, subtree: true });
      priceEl.dataset.mtlPriceObs = "1";
    }

    var wm = document.getElementById("wmSummary");
    if (wm && wm.dataset.mtlSumObs !== "1") {
      var oLeather = new MutationObserver(updateProductSummary);
      oLeather.observe(wm, { childList: true, characterData: true, subtree: true });
      wm.dataset.mtlSumObs = "1";
    }

    var mcLeather = document.getElementById("mcLeatherSummary");
    if (mcLeather && mcLeather.dataset.mtlSumObs !== "1") {
      var oMc = new MutationObserver(updateProductSummary);
      oMc.observe(mcLeather, { childList: true, characterData: true, subtree: true });
      mcLeather.dataset.mtlSumObs = "1";
    }
  }

  function attachListeners(section, configSelect) {
    if (section.dataset.mtlWired === "1") return;

    section.addEventListener("click", function (e) {
      var card = e.target.closest(".mtl-sectional-card");
      if (!card || !section.contains(card)) return;
      var code = card.getAttribute("data-config-code");
      if (code) selectConfigCard(section, code);
    });

    if (configSelect && configSelect.dataset.mtlSummaryListener !== "1") {
      configSelect.addEventListener("change", function () {
        window.setTimeout(updateProductSummary, 0);
      });
      configSelect.dataset.mtlSummaryListener = "1";
    }

    ensureSummaryObservers();

    section.dataset.mtlWired = "1";
  }

  function renderSectionalConfigs() {
    try {
      var configs = getConfigsObject();
      if (!configs || typeof configs !== "object" || !Object.keys(configs).length) {
        return;
      }

      var productKey = getProductKey(configs);
      var matchedConfigs = productKey ? configs[productKey] : [];

      if (!Array.isArray(matchedConfigs) || !matchedConfigs.length) {
        return;
      }

      var existingSection = document.getElementById("mtl-sectional-configurations");
      if (existingSection && existingSection.dataset.mtlWired === "1") {
        var exSum = document.getElementById("mtl-product-summary");
        if (exSum) placeAfterLeather(existingSection, exSum);
        hideNativeConfigurationRow(findConfigurationSelect());
        ensureSummaryObservers();
        updateProductSummary();
        return;
      }

      var configSelect = findConfigurationSelect();
      if (!configSelect) {
        return;
      }

      hideNativeConfigurationRow(configSelect);

      var filtered = matchedConfigs.filter(function (c) {
        return c && c.code && volusionHasOption(configSelect, c.code);
      });
      if (!filtered.length) {
        console.warn("No sectional configs match Volusion options", productKey);
        return;
      }

      state.cfgByCode = {};
      filtered.forEach(function (c) {
        state.cfgByCode[c.code] = c;
      });

      var section = existingSection || document.createElement("section");
      section.id = "mtl-sectional-configurations";
      section.className = "mtl-sectional-configurations";

      section.innerHTML = "";
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
        card.setAttribute("data-config-code", cfg.code);

        var imgWrap = document.createElement("div");
        imgWrap.className = "mtl-sectional-image-wrap";
        var img = document.createElement("img");
        img.className = "mtl-sectional-image";
        var imgSrc = normalizeImage(cfg.image);
        if (imgSrc.indexOf("?") === -1) imgSrc = imgSrc + "?v=" + IMG_BUST;
        else imgSrc = imgSrc + "&v=" + IMG_BUST;
        img.src = imgSrc;
        img.alt = cfg.label || cfg.code || "Sectional configuration";
        imgWrap.appendChild(img);

        var info = document.createElement("div");
        info.className = "mtl-sectional-info";
        var title = document.createElement("div");
        title.className = "mtl-sectional-title";
        title.textContent = cfg.label || cfg.code || "";
        var desc = document.createElement("div");
        desc.className = "mtl-sectional-desc";
        desc.textContent = cfg.description || "";
        info.appendChild(title);
        info.appendChild(desc);
        if (cfg.priceDiff) {
          var pd = document.createElement("div");
          pd.className = "mtl-sectional-price";
          pd.textContent = "Upgrade +$" + cfg.priceDiff;
          info.appendChild(pd);
        }
        card.appendChild(imgWrap);
        card.appendChild(info);
        grid.appendChild(card);
      });

      inner.appendChild(h);
      inner.appendChild(grid);
      section.appendChild(inner);

      var summary = ensureProductSummary();
      placeAfterLeather(section, summary);
      attachListeners(section, configSelect);

      var baseConfig =
        filtered.find(function (c) {
          return c.base === true;
        }) || filtered[0];
      if (baseConfig) {
        selectConfigCard(section, baseConfig.code);
      } else {
        updateProductSummary();
      }

      console.log("sectional configurations inserted", filtered.length);
    } catch (err) {
      console.error("Sectional renderer failed:", err);
    }
  }

  function scheduleRender() {
    renderSectionalConfigs();

    setTimeout(renderSectionalConfigs, 500);
    setTimeout(renderSectionalConfigs, 1500);
    setTimeout(renderSectionalConfigs, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRender);
  } else {
    scheduleRender();
  }

  window.addEventListener("load", scheduleRender);
})();
