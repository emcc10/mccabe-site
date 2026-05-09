/**
 * Sectional diagram cards — runs after sectional-configs.js (window.MTL_SECTIONAL_CONFIGS).
 * Must not throw uncaught errors (wrapped startup).
 */
(function () {
  "use strict";

  console.log("sectional renderer loaded");

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function normalize(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, "").replace(/_/g, "-");
  }

  function getConfigsRoot() {
    return window.MTL_SECTIONAL_CONFIGS || window.SECTIONAL_CONFIGS || null;
  }

  function getStyleFromPage(configsRoot) {
    if (!configsRoot) return null;

    var bodyText = document.body ? document.body.innerText : "";
    var path = window.location.pathname;
    var combined = normalize(path + " " + bodyText);

    return Object.keys(configsRoot).find(function (style) {
      return (
        combined.includes(normalize(style + "-SC")) || combined.includes(normalize(style))
      );
    });
  }

  function normalizeDiagramImageUrl(raw) {
    var s = String(raw || "").trim();
    if (!s) return s;
    if (/^\/v\//i.test(s)) return s;
    var base = s.replace(/^.*\//, "").replace(/^\//, "");
    if (!base) return "/v/vspfiles/sectional-diagrams/";
    return "/v/vspfiles/sectional-diagrams/" + base;
  }

  function findConfigSelect(configs) {
    var selects = Array.from(document.querySelectorAll("select"));

    return selects.find(function (select) {
      if (select.classList && select.classList.contains("mc-native-leather")) return false;
      var optionText = Array.from(select.options || [])
        .map(function (opt) {
          return (opt.textContent || "") + " " + (opt.value || "");
        })
        .join(" ");

      return configs.some(function (cfg) {
        return optionText.indexOf(cfg.code) !== -1;
      });
    });
  }

  function triggerChange(select) {
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (typeof jQuery !== "undefined") {
      jQuery(select).trigger("change");
    }
  }

  function markConfigRowOnly(select) {
    var row = select.closest("tr") || select.closest("div");
    if (row) row.classList.add("mtl-native-config-row");
  }

  function selectConfig(select, cfg, grid) {
    var match = Array.from(select.options || []).find(function (opt) {
      return (
        (opt.textContent || "").indexOf(cfg.code) !== -1 ||
        (opt.value || "").indexOf(cfg.code) !== -1
      );
    });

    if (!match) {
      console.warn("No matching Volusion option for config:", cfg.code);
      return;
    }

    select.value = match.value;
    triggerChange(select);

    Array.from(grid.querySelectorAll(".sectional-config-card")).forEach(function (card) {
      card.classList.toggle(
        "is-selected",
        card.getAttribute("data-config-code") === cfg.code
      );
    });
  }

  function initSectionalRenderer() {
    var configsRoot = getConfigsRoot();
    if (!configsRoot) {
      console.warn("MTL_SECTIONAL_CONFIGS / SECTIONAL_CONFIGS missing.");
      return;
    }

    var style = getStyleFromPage(configsRoot);
    if (!style) {
      return;
    }

    var matchedConfigs = configsRoot[style];
    if (!matchedConfigs || !matchedConfigs.length) {
      console.warn("No configs found for style:", style);
      return;
    }

    console.log("sectional page match", location.pathname, matchedConfigs);

    var select = findConfigSelect(matchedConfigs);
    if (!select) {
      console.warn("Configuration dropdown not found for style:", style);
      return;
    }

    if (document.querySelector("#sectionalConfigSelector")) return;

    var wrap = document.createElement("div");
    wrap.id = "sectionalConfigSelector";
    wrap.className = "sectional-config-selector";

    var title = document.createElement("div");
    title.className = "sectional-config-title";
    title.textContent = "Choose Configuration";
    wrap.appendChild(title);

    var grid = document.createElement("div");
    grid.className = "sectional-config-grid";

    matchedConfigs.forEach(function (cfg) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "sectional-config-card";
      card.setAttribute("data-config-code", cfg.code);

      var imgSrc = normalizeDiagramImageUrl(cfg.image);

      card.innerHTML =
        '<div class="sectional-config-img-wrap">' +
        '<img src="' +
        imgSrc +
        "?v=20260509a" +
        '" alt="' +
        String(cfg.label || cfg.code).replace(/"/g, "&quot;") +
        '">' +
        "</div>" +
        '<div class="sectional-config-label">' +
        String(cfg.label || cfg.code).replace(/</g, "&lt;") +
        "</div>" +
        (cfg.description
          ? '<div class="sectional-config-desc">' +
            String(cfg.description).replace(/</g, "&lt;") +
            "</div>"
          : "");

      card.addEventListener("click", function () {
        selectConfig(select, cfg, grid);
      });

      grid.appendChild(card);
    });

    wrap.appendChild(grid);

    var optionsTable = document.querySelector("#options_table");
    if (optionsTable && optionsTable.parentNode) {
      optionsTable.parentNode.insertBefore(wrap, optionsTable);
    } else {
      select.parentNode.insertBefore(wrap, select);
    }

    var baseConfig = matchedConfigs
      .slice()
      .sort(function (a, b) {
        return Number(a.priceDiff || 0) - Number(b.priceDiff || 0);
      })[0];

    if (baseConfig) {
      selectConfig(select, baseConfig, grid);
    }

    markConfigRowOnly(select);
    document.documentElement.classList.add("has-sectional-config-cards");

    console.log("MTL sectional cards rendered:", style, matchedConfigs.length);
  }

  function safeInit() {
    try {
      initSectionalRenderer();
    } catch (err) {
      console.error("Sectional renderer failed:", err);
    }
  }

  ready(safeInit);
  window.addEventListener("load", safeInit);
  [400, 1200, 2500, 5000].forEach(function (ms) {
    setTimeout(safeInit, ms);
  });

  window.initSectionalRenderer = initSectionalRenderer;
})();
