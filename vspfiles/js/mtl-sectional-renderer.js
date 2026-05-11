/**
 * Sectional PDP: configuration diagrams, native select sync, product summary.
 * Cache: debug-fix-20260511-2
 */
(function () {
  "use strict";

  var IMG_V = "debug-fix-20260511-2";

  var CART_ICON_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mc-cart-icon" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';

  /** Same inner markup as theater <a id="mcProductSummaryBtn"> in template_266.html (#mc-inline-config). */
  var PRODUCT_SUMMARY_LINK_INNER =
    '<span>Product Summary</span><span class="mc-btn-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>';
  var SECTIONAL_DBG = /(?:[?&])mtlSectionalDebug=1(?:&|$)/.test(String(location.search || ""));
  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220"><rect fill="#f2f2f2" width="360" height="220"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="13">Configuration diagram</text></svg>'
    );

  var state = { cfgByCode: {}, cfgByNativeValue: {} };

  window.MTL_RENDERER_VERSION = "debug-fix-20260511-2";
  console.log("MTL_RENDERER_VERSION debug-fix-20260511-2");

  function isSectionalProductPageClient() {
    if (typeof window.isSectionalProductPage === "function" && window.isSectionalProductPage()) return true;
    return document.documentElement.classList.contains("is-sectional-product");
  }

  function isVolusionConfigurationRowSelect(sel) {
    try {
      var rowText = "";
      var tr = sel.closest("tr");
      var td = sel.closest("td");
      if (tr) rowText += " " + tr.innerText;
      if (td) rowText += " " + td.innerText;
      if (sel.parentElement) rowText += " " + sel.parentElement.innerText;
      rowText = rowText.toLowerCase();
      if (!/choose configuration|configuration/i.test(rowText)) return false;
      if (/(choose cover|choose leather|select leather|select a leather|upholstery|leather|fabric cover)/i.test(rowText))
        return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function findNativeLeatherSelectEl() {
    var sels = Array.from(
      document.querySelectorAll("#options_table select, #v65-product-parent select, table[id*='options_table'] select")
    );
    var i;
    var m = document.querySelector("select.mc-native-leather");
    if (m && !isVolusionConfigurationRowSelect(m)) return m;
    for (i = 0; i < sels.length; i++) {
      var sel = sels[i];
      if (isVolusionConfigurationRowSelect(sel)) continue;
      var rowText = "";
      var tr = sel.closest("tr");
      if (tr) rowText = String(tr.innerText || "").toLowerCase();
      if (
        sel.classList.contains("mc-native-leather") ||
        /(choose cover|choose leather|select leather|select a leather|upholstery|cover|fabric)/i.test(rowText)
      ) {
        return sel;
      }
    }
    return null;
  }

  function isPlaceholderLeatherOption(opt) {
    var t = String(opt.textContent || "").trim();
    var v = String(opt.value || "").trim();
    if (!t || !v) return true;
    if (/choose|select|please select|^--|^-$/i.test(t)) return true;
    return false;
  }

  function buildSyntheticWmLeatherOptionsFromSelect(sel) {
    if (!sel || !sel.options) return [];
    var out = [];
    Array.prototype.forEach.call(sel.options, function (opt) {
      if (isPlaceholderLeatherOption(opt)) return;
      var label = String(opt.textContent || "").replace(/\s+/g, " ").trim();
      var value = String(opt.value || "").trim();
      var parts = label.split(/\s+/).filter(Boolean);
      var family = parts[0] || label;
      var color = parts.slice(1).join(" ") || "";
      out.push({
        family: family,
        color: color,
        grade: "Base",
        value: value,
        swatches: [],
        label: label,
      });
    });
    return out;
  }

  function ensureLeatherOptionsFromNativeSelect(leatherSel) {
    if (!leatherSel || !leatherSel.options || leatherSel.options.length < 1) return;
    var syn = buildSyntheticWmLeatherOptionsFromSelect(leatherSel);
    if (!syn.length) return;
    var prev = Array.isArray(window.__WM_LEATHER_OPTIONS__) ? window.__WM_LEATHER_OPTIONS__.length : 0;
    if (!window.__WM_LEATHER_OPTIONS__ || window.__WM_LEATHER_OPTIONS__.length === 0 || syn.length > prev) {
      window.__WM_LEATHER_OPTIONS__ = syn;
      try {
        document.dispatchEvent(new CustomEvent("wmLeatherOptionsReady", { bubbles: true }));
      } catch (eEvt) {}
      console.log("[MTL debug] __WM_LEATHER_OPTIONS__ set from native select, count=", syn.length);
    }
  }

  function renderFallbackLeatherIntoWmSections(leatherSel) {
    if (!isSectionalProductPageClient() || !leatherSel) return;
    var wmSections = document.getElementById("wmSections");
    if (!wmSections) return;
    var syn = buildSyntheticWmLeatherOptionsFromSelect(leatherSel);
    if (!syn.length) return;
    if (wmSections.querySelector(".wm-tile")) return;
    var ex = wmSections.querySelector(".mtl-fallback-leather-grid");
    if (ex) ex.remove();
    var wrap = document.createElement("div");
    wrap.className = "mtl-fallback-leather-grid";
    wrap.style.cssText = "margin:8px 0;padding:8px;border:1px dashed #888;background:#fafafa;";
    var cap = document.createElement("div");
    cap.textContent = "Leather / cover options (from native select)";
    cap.style.cssText = "font-size:12px;font-weight:600;margin-bottom:8px;";
    wrap.appendChild(cap);
    var grid = document.createElement("div");
    grid.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;max-height:55vh;overflow:auto;";
    syn.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mtl-fallback-leather-btn";
      b.style.cssText =
        "padding:10px 12px;border:1px solid #333;background:#fff;cursor:pointer;text-align:left;font-size:13px;";
      b.textContent = o.label;
      b.title = o.label;
      b.onclick = function (ev) {
        ev.preventDefault();
        leatherSel.value = o.value;
        leatherSel.dispatchEvent(new Event("change", { bubbles: true }));
        leatherSel.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof jQuery !== "undefined") jQuery(leatherSel).trigger("change");
        var wmSummary = document.getElementById("wmSummary");
        if (wmSummary) wmSummary.textContent = o.label;
        var mcSum = document.getElementById("mcLeatherSummary");
        if (mcSum) mcSum.textContent = o.label;
        var ov = document.querySelector(".wm-overlay");
        if (ov) ov.style.display = "none";
      };
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    wmSections.appendChild(wrap);
  }

  function patchLeatherModalFallback(leatherSel) {
    if (!isSectionalProductPageClient()) return;
    if (document.documentElement.dataset.mtlWmModalFallbackPatched === "1") return;
    document.documentElement.dataset.mtlWmModalFallbackPatched = "1";
    document.addEventListener(
      "click",
      function () {
        window.setTimeout(function () {
          var ov = document.querySelector(".wm-overlay");
          if (!ov) return;
          var disp = "";
          try {
            disp = window.getComputedStyle(ov).display;
          } catch (eC) {}
          if (disp === "none") return;
          renderFallbackLeatherIntoWmSections(leatherSel || findNativeLeatherSelectEl());
        }, 180);
      },
      true
    );
  }

  function removeStandaloneDuplicateProductSummary() {
    if (!isSectionalProductPageClient()) return;
    var st = document.getElementById("mcProductSummaryRowStandalone");
    if (st) {
      st.remove();
      console.log("[MTL] removed #mcProductSummaryRowStandalone (duplicate Product Summary)");
    }
  }

  function applyAlulaPalliserPdfHref() {
    if (!isSectionalProductPageClient()) return;
    var hay = (
      String(document.title || "") +
      " " +
      String(location.pathname || "") +
      " " +
      String((document.querySelector('input[name="ProductCode"]') || {}).value || "")
    ).toLowerCase();
    if (!/alula|aloira/.test(hay)) return;
    var a = document.getElementById("mcProductSummaryBtn");
    if (!a) return;
    var url = "https://images.palliser.com/specsheet/en/" + encodeURIComponent("77427 Alula") + ".pdf";
    a.href = url;
    a.style.opacity = "";
    a.setAttribute("aria-disabled", "false");
    var spans = a.querySelectorAll("span");
    var k;
    for (k = 0; k < spans.length; k++) {
      if (!(spans[k].classList && spans[k].classList.contains("mc-btn-icon"))) {
        spans[k].textContent = "Product Summary";
        break;
      }
    }
    a.title = "Open Palliser product summary (PDF) — 77427 · Alula";
    console.log("[MTL] mcProductSummaryBtn href forced to Alula PDF:", url);
  }

  function collectMtlDebugSnapshot(ctx) {
    ctx = ctx || {};
    var pcEl = document.querySelector('input[name="ProductCode"], input[name="productcode"]');
    var productCode = pcEl ? String(pcEl.value || "").trim() : "";
    var titleEl = document.querySelector("h1") || document.querySelector(".productnamecolor");
    var titleText = titleEl ? String(titleEl.textContent || "").replace(/\s+/g, " ").trim() : "";

    var palliserModel = "";
    var palliserStyle = "";
    var summaryHref = "";
    try {
      if (typeof window.mcPalliserResolveModelAndStyle === "function") {
        var r = window.mcPalliserResolveModelAndStyle();
        palliserModel = (r && r.model) || "";
        palliserStyle = (r && r.style) || "";
      }
      if (typeof window.mcBuildPalliserSpecSheetUrl === "function") summaryHref = window.mcBuildPalliserSpecSheetUrl() || "";
    } catch (eP) {}

    var cfgSel = findConfigurationSelect();
    var mergedPreview = [];
    try {
      var pk = "";
      var pageBlob = (
        String(location.pathname) +
        " " +
        String(document.title) +
        " " +
        String(titleText)
      ).toLowerCase();
      var allC = window.MTL_SECTIONAL_CONFIGS || {};
      pk =
        Object.keys(allC).find(function (k) {
          return pageBlob.indexOf(k.toLowerCase()) !== -1;
        }) || "";
      var jfk = pk && allC[pk] ? allC[pk] : [];
      if (cfgSel) mergedPreview = mergeNativeOptionsWithJson(cfgSel, Array.isArray(jfk) ? jfk : [], pk, productCode);
    } catch (eM) {
      mergedPreview = [{ error: String(eM.message || eM) }];
    }

    var cfgIds = mergedPreview.map(function (m) {
      return m && (m.code != null || m.nativeValue != null) ? String(m.code || "") + ":" + String(m.nativeValue || "") : "?";
    });

    var defaultCfg = "";
    if (cfgSel && mergedPreview.length) {
      var sv = String(cfgSel.value || "");
      var hit = mergedPreview.find(function (m) {
        return String(m.nativeValue) === sv;
      });
      defaultCfg = hit ? String(hit.code || hit.label || "") : String(mergedPreview[0].code || "");
    }

    var leatherSel = findNativeLeatherSelectEl();
    var leatherOptCount = leatherSel && leatherSel.options ? leatherSel.options.length : 0;
    var leatherTexts = [];
    if (leatherSel && leatherSel.options) {
      var j;
      for (j = 0; j < Math.min(10, leatherSel.options.length); j++) {
        leatherTexts.push(String(leatherSel.options[j].textContent || "").trim());
      }
    }

    var wmOpts = window.__WM_LEATHER_OPTIONS__;
    var wmOptsYes = Array.isArray(wmOpts) && wmOpts.length > 0;

    var wmSections = document.getElementById("wmSections");
    var modalSwatchCount = wmSections
      ? wmSections.querySelectorAll(".wm-tile, .mtl-fallback-leather-btn").length
      : 0;

    var miniStrip = document.getElementById("mcLeatherSwatchStrip");
    var miniCount = miniStrip ? miniStrip.querySelectorAll(".mc-mini-swatch, button").length : 0;

    return {
      productCode: productCode,
      titleText: titleText,
      detectedStyleName: palliserStyle,
      palliserStyleNumber: palliserModel,
      productSummaryHref: summaryHref || (document.getElementById("mcProductSummaryBtn") || {}).href || "",
      mergedRecordCount: mergedPreview.length,
      firstTenConfigIds: cfgIds.slice(0, 10),
      defaultConfigurationDetected: defaultCfg,
      leatherNativeSelectFound: !!leatherSel,
      leatherNativeOptionCount: leatherOptCount,
      firstTenLeatherOptionTexts: leatherTexts,
      leatherSwatchDataSourceFound: wmOptsYes,
      leatherModalContainerFound: !!wmSections,
      leatherModalSwatchCountAfterRender: modalSwatchCount,
      miniSwatchContainerFound: !!miniStrip,
      miniSwatchCountAfterRender: miniCount,
      mergedRecordsFull: mergedPreview,
      context: ctx,
    };
  }

  function renderMtlDebugPanel(data) {
    var id = "mtl-debug-panel";
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.cssText =
        "position:fixed;left:8px;bottom:8px;z-index:99999;max-width:min(440px,94vw);max-height:70vh;overflow:auto;background:#111;color:#eee;font:12px/1.4 Consolas,monospace;padding:10px 12px;border:2px solid #fc0;box-shadow:0 4px 20px rgba(0,0,0,.4);";
      document.body.appendChild(el);
    }
    window.__MTL_DEBUG_SNAPSHOT__ = data;
    console.log("[MTL DEBUG]", data);
    var lines = [
      "MTL_RENDERER_VERSION: " + String(window.MTL_RENDERER_VERSION || ""),
      "1. ProductCode: " + data.productCode,
      "2. Title: " + data.titleText,
      "3. Detected style name: " + data.detectedStyleName,
      "4. Palliser style #: " + data.palliserStyleNumber,
      "5. Product Summary href: " + data.productSummaryHref,
      "6. Config records (merged): " + data.mergedRecordCount,
      "7. First 10 config id:value — " + JSON.stringify(data.firstTenConfigIds),
      "8. Default config: " + data.defaultConfigurationDetected,
      "9. Leather native select: " + (data.leatherNativeSelectFound ? "yes" : "no"),
      "10. Leather option count: " + data.leatherNativeOptionCount,
      "11. First 10 leather texts — " + JSON.stringify(data.firstTenLeatherOptionTexts),
      "12. __WM_LEATHER_OPTIONS__ populated: " + (data.leatherSwatchDataSourceFound ? "yes" : "no"),
      "13. #wmSections exists: " + (data.leatherModalContainerFound ? "yes" : "no"),
      "14. Modal tile/fallback btn count: " + data.leatherModalSwatchCountAfterRender,
      "15. Mini strip #mcLeatherSwatchStrip: " + (data.miniSwatchContainerFound ? "yes" : "no"),
      "16. Mini swatch count: " + data.miniSwatchCountAfterRender,
    ];
    el.textContent = lines.join("\n");
  }

  function shouldRunSectionalDiagnostics() {
    if (isSectionalProductPageClient()) return true;
    if (/-sc-/i.test(String(location.pathname || ""))) return true;
    try {
      var pc = String((document.querySelector('input[name="ProductCode"]') || {}).value || "").toLowerCase();
      if (/-sc-/.test(pc)) return true;
    } catch (ePc) {}
    return false;
  }

  function runMtlSectionalDiagnostic(label) {
    if (!shouldRunSectionalDiagnostics()) return;
    try {
      var snap = collectMtlDebugSnapshot({ when: label || "" });
      renderMtlDebugPanel(snap);
    } catch (eDiag) {
      console.error("[MTL DEBUG collect failed]", eDiag);
    }
  }

  function sectionalLog() {
    if (!SECTIONAL_DBG) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[mtl-sectional]");
    console.log.apply(console, args);
  }

  function sectionalIsLoggedIn() {
    return !!(document.body && document.body.classList.contains("mc-member-logged-in"));
  }

  function quoteMailtoHref() {
    var a = document.querySelector('footer a[href^="mailto:"]');
    if (a) {
      var h = String(a.getAttribute("href") || "").trim();
      if (/^mailto:/i.test(h)) return h;
    }
    return "mailto:erin@mccabestheaterandliving.com";
  }

  function ensureMemberClassObserver() {
    if (typeof MutationObserver === "undefined" || !document.body) return;
    if (document.body.dataset.mtlSectionalMemberObs === "1") return;
    document.body.dataset.mtlSectionalMemberObs = "1";
    var obs = new MutationObserver(function () {
      syncCardsSelectionHighlight();
      updateProductSummary();
      updateSectionalCardPriceBadges();
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
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

  /** Mirrors template_266 injectAddToCartIcon (~10567) when Volusion markup lacks .mc-atc-button-wrap. */
  function ensureSectionalAtcChrome() {
    if (!document.documentElement.classList.contains("is-sectional-product")) return;
    var root =
      document.getElementById("v65-product-parent") ||
      document.getElementById("content_area") ||
      document.body;
    var btn = root.querySelector(
      'input[name="btnaddtocart"], input[id*="btnaddtocart"], button[name="btnaddtocart"]'
    );
    if (!btn || !btn.parentNode) return;

    if (btn.tagName === "INPUT" && String(btn.type || "").toLowerCase() === "image") {
      try {
        btn.type = "submit";
      } catch (eImg) {}
      btn.removeAttribute("src");
      if (!btn.value) btn.value = "ADD TO CART";
    }

    var wrapExisting = btn.closest(".mc-atc-button-wrap");
    if (wrapExisting) {
      wrapExisting.style.setProperty("display", "inline-flex", "important");
      wrapExisting.style.setProperty("align-items", "center", "important");
      wrapExisting.style.setProperty("gap", "12px", "important");
      var parEx = wrapExisting.parentNode;
      if (parEx && parEx.classList) parEx.classList.add("mc-atc-row");
      return;
    }

    var oldWrap = btn.closest(".mc-atc-wrap");
    if (oldWrap) {
      while (oldWrap.firstChild) oldWrap.parentNode.insertBefore(oldWrap.firstChild, oldWrap);
      oldWrap.remove();
    }

    var parent = btn.parentNode;
    var wrapper = document.createElement("div");
    wrapper.className = "mc-atc-button-wrap";
    parent.insertBefore(wrapper, btn);
    wrapper.appendChild(btn);
    var iconWrap = document.createElement("span");
    iconWrap.innerHTML = CART_ICON_SVG;
    iconWrap.classList.add("mc-cart-icon-wrapper");
    wrapper.appendChild(iconWrap);
    wrapper.style.setProperty("display", "inline-flex", "important");
    wrapper.style.setProperty("align-items", "center", "important");
    wrapper.style.setProperty("gap", "12px", "important");
    if (parent.classList) parent.classList.add("mc-atc-row");
  }

  function scheduleSectionalAtcChrome() {
    ensureSectionalAtcChrome();
    [400, 1200, 2800, 5200].forEach(function (ms) {
      setTimeout(ensureSectionalAtcChrome, ms);
    });
  }

  /**
   * Open Westmere/Palliser leather modal — same trigger as template_266 initIfReady assigns to #wmOpen (~2835).
   * Verification path: (1) Theme hides #wmOpen with display:none (#wmOpen rule ~2015) → custom-safe overrides for
   *     html.is-sectional-product so the node is off-screen but not display:none (reliable programmatic click).
   * (2) After config cards sync, mcTryInitWmLeather / boot interval builds #wmOpen; we listen for mcWmOpenMounted.
   * (3) Clicks use window.mcOpenWmLeatherModal (template_266 mount IIFE) so #wmOpen is resolved after async init.
   * (4) jQuery .trigger("click") after native .click(); overlay z-index: html.is-sectional-product .wm-overlay.
   */

  function ensureMcWmOpenMountedListener() {
    if (document.documentElement.dataset.mtlWmOpenMountedListen === "1") return;
    document.documentElement.dataset.mtlWmOpenMountedListen = "1";
    document.addEventListener(
      "mcWmOpenMounted",
      function () {
        if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
      },
      false
    );
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
    if (typeof window.mcTryInitWmLeather === "function") {
      window.mcTryInitWmLeather();
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

  function styleSegmentToPascal(segment) {
    var s = String(segment || "")
      .trim()
      .toLowerCase();
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Prefix like "Alula-SC" to match filenames in sectional-configs.js (e.g. Alula-SC-07-15.png). */
  function getSectionalDiagramPrefix(productKey, pcVal) {
    if (productKey) {
      var pk = String(productKey).replace(/\s+/g, "").trim();
      if (pk) return pk + "-SC";
    }
    var pc = String(pcVal || "").trim();
    var m = pc.match(/^([A-Za-z][A-Za-z0-9]*)-SC(?:-|$)/i);
    if (!m) return "";
    return styleSegmentToPascal(m[1]) + "-SC";
  }

  function inferSectionalDiagramPngUrl(productKey, pcVal, configCode) {
    var prefix = getSectionalDiagramPrefix(productKey, pcVal);
    var cod = normalizeCode(configCode).replace(/\s+/g, "");
    if (!prefix || !cod) return "";
    return "/v/vspfiles/sectional-diagrams/" + prefix + "-" + cod + ".png";
  }

  function refreshProductPriceLabel() {
    var sum = document.getElementById("mtl-product-summary");
    if (!sum) return;
    var nodes = sum.querySelectorAll(
      ".mtl-summary-label, .mtl-summary-row > span:first-of-type, .mtl-summary-row > div:first-of-type"
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var t = String(el.textContent || "");
      if (/estimated/i.test(t) && /price/i.test(t)) el.textContent = "Product Price";
    }
  }

  function ensureProductSummary(section) {
    var sum = document.getElementById("mtl-product-summary");
    var legacyAdj = document.getElementById("mtl-sum-adj");
    if (legacyAdj) {
      var adjRow = legacyAdj.closest && legacyAdj.closest(".mtl-summary-row");
      if (adjRow) adjRow.remove();
    }
    if (!sum) {
      sum = document.createElement("div");
      sum.id = "mtl-product-summary";
      sum.innerHTML =
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Selected Configuration</span><span class="mtl-summary-value" id="mtl-sum-config">—</span></div>' +
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Product Price</span><span class="mtl-summary-value" id="mtl-sum-price">—</span></div>' +
        '<p id="mtl-sectional-quote-hint" class="mtl-sectional-quote-hint"></p>';
      sum.dataset.mtlSummaryV3 = "1";
    } else {
      upgradeProductSummaryDom(sum);
    }
    if (section && section.parentNode) {
      try {
        section.parentNode.insertBefore(sum, section.nextSibling);
      } catch (eIns) {}
    }
    refreshProductPriceLabel();
    refreshQuoteAndPalliserSummary();
    return sum;
  }

  function upgradeProductSummaryDom(sum) {
    if (!sum) return;
    sum.querySelectorAll(".mtl-summary-row--spec, .mtl-summary-row--dims").forEach(function (row) {
      row.remove();
    });
    var sumLeatherEl = document.getElementById("mtl-sum-leather");
    if (sumLeatherEl) {
      var sumLeatherRow = sumLeatherEl.closest(".mtl-summary-row");
      if (sumLeatherRow) sumLeatherRow.remove();
    }
    var specA = document.getElementById("mtl-sum-spec");
    if (specA) {
      var specRow = specA.closest(".mtl-summary-row");
      if (specRow) specRow.remove();
    }
    var dimsN = document.getElementById("mtl-sum-dims");
    if (dimsN) {
      var dimRow = dimsN.closest(".mtl-summary-row");
      if (dimRow) dimRow.remove();
    }
    sum.querySelectorAll(".mtl-summary-row--palliser-summary").forEach(function (r) {
      r.remove();
    });
    var oldPs = document.getElementById("mtl-sum-palliser-summary");
    if (oldPs && oldPs.closest(".mtl-summary-row--palliser-summary")) {
      oldPs.closest(".mtl-summary-row--palliser-summary").remove();
    }
    if (!document.getElementById("mtl-sectional-quote-hint")) {
      var hint = document.createElement("p");
      hint.id = "mtl-sectional-quote-hint";
      hint.className = "mtl-sectional-quote-hint";
      sum.appendChild(hint);
    }
    sum.dataset.mtlSummaryV3 = "1";
  }

  function refreshQuoteAndPalliserSummary() {
    var hint = document.getElementById("mtl-sectional-quote-hint");
    if (hint) {
      var mail = quoteMailtoHref();
      hint.textContent = "";
      hint.appendChild(document.createTextNode("For custom quotes "));
      var ma = document.createElement("a");
      ma.href = mail;
      ma.textContent = "send us an email";
      hint.appendChild(ma);
      hint.appendChild(document.createTextNode("."));
    }
    if (typeof window.mcRefreshProductSummaryButton === "function") window.mcRefreshProductSummaryButton();
  }

  function updateProductSummary() {
    var legacyAdj = document.getElementById("mtl-sum-adj");
    if (legacyAdj) {
      var adjRow = legacyAdj.closest && legacyAdj.closest(".mtl-summary-row");
      if (adjRow) adjRow.remove();
    }
    var sum = document.getElementById("mtl-product-summary");
    if (!sum) return;
    upgradeProductSummaryDom(sum);
    refreshProductPriceLabel();

    var code = window.__mtlSectionalSelectedConfig;
    var nv = window.__mtlSectionalPreferredNativeValue;
    var cfg =
      nv != null && state.cfgByNativeValue[String(nv)]
        ? state.cfgByNativeValue[String(nv)]
        : code
          ? state.cfgByCode[normalizeCode(code)]
          : null;
    var configLabel = cfg ? cfg.label || cfg.code || code : code || "—";

    var price = readDisplayedPrice();

    var elC = document.getElementById("mtl-sum-config");
    var elP = document.getElementById("mtl-sum-price");
    if (elC) elC.textContent = configLabel;
    if (elP) {
      elP.classList.remove("mtl-summary-price--guest");
      if (sectionalIsLoggedIn()) {
        elP.textContent = price || "—";
      } else {
        elP.classList.add("mtl-summary-price--guest");
        elP.innerHTML =
          '<a href="#" class="mc-member-grid-price__login" data-mc-open-login>Log in</a> to see price';
      }
    }
    refreshQuoteAndPalliserSummary();
  }

  function scheduleProductSummaryAfterConfigChange() {
    [250, 800, 1500].forEach(function (ms) {
      setTimeout(function () {
        if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
        updateProductSummary();
      }, ms);
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
          if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
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

    scheduleConfigSelectOptionsWatch(configSel);
  }

  var __mtlCfgOptWatchTimer = null;
  var __mtlCfgOptWatchLastLen = -1;

  function scheduleConfigSelectOptionsWatch(sel) {
    if (!sel || sel.dataset.mtlCfgOptionsObs === "1") return;
    sel.dataset.mtlCfgOptionsObs = "1";
    __mtlCfgOptWatchLastLen = sel.options ? sel.options.length : 0;
    if (typeof MutationObserver === "undefined") return;
    var obs = new MutationObserver(function () {
      var n = sel.options ? sel.options.length : 0;
      if (n === __mtlCfgOptWatchLastLen) return;
      __mtlCfgOptWatchLastLen = n;
      var sec = document.getElementById("mtl-sectional-configurations");
      if (sec) sec.removeAttribute("data-mtl-final-init");
      if (__mtlCfgOptWatchTimer) clearTimeout(__mtlCfgOptWatchTimer);
      __mtlCfgOptWatchTimer = setTimeout(function () {
        runRender();
      }, 120);
    });
    try {
      obs.observe(sel, { childList: true, subtree: true });
    } catch (eObs) {}
  }

  function formatPriceDiffLabel(diff) {
    var n = Number(diff);
    if (!isFinite(n) || n === 0) return "";
    if (n > 0) return "+$" + String(Math.round(n));
    return "−$" + String(Math.round(Math.abs(n)));
  }

  function updateSectionalCardPriceBadges() {
    var sec = document.getElementById("mtl-sectional-configurations");
    if (!sec) return;
    var logged = sectionalIsLoggedIn();
    var cards = sec.querySelectorAll(".mtl-sectional-card");
    Array.prototype.forEach.call(cards, function (card) {
      var raw = card.getAttribute("data-mtl-price-diff");
      var label = formatPriceDiffLabel(raw);
      var ex = card.querySelector(".mtl-sectional-price");
      if (!logged || !label) {
        if (ex) ex.remove();
        return;
      }
      if (!ex) {
        ex = document.createElement("div");
        ex.className = "mtl-sectional-price";
        card.appendChild(ex);
      }
      ex.textContent = label;
    });
  }

  function mergeNativeOptionsWithJson(configSelect, jsonCfgs, productKey, pcVal) {
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
      var mergedCode = (jsonHit && jsonHit.code) || primary;
      var image = jsonHit && jsonHit.image ? String(jsonHit.image).trim() : "";
      if (!image) {
        image = inferSectionalDiagramPngUrl(productKey, pcVal, mergedCode);
      }
      var priceDiff = jsonHit && jsonHit.priceDiff != null ? jsonHit.priceDiff : null;

      merged.push({
        code: mergedCode,
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

  /** Sectional mount hides #mcPlannerRow in template; restore row and keep only Product Summary (hide Room Planner). */
  function ensureInlineProductSummaryVisibleWithPlannerHidden() {
    if (!document.documentElement.classList.contains("is-sectional-product")) return;
    var row = document.getElementById("mcPlannerRow");
    var plannerBtn = document.getElementById("mcPlannerBtn");
    var summaryBtn = document.getElementById("mcProductSummaryBtn");
    if (row) {
      row.style.setProperty("display", "flex", "important");
      row.style.setProperty("visibility", "visible", "important");
    }
    if (plannerBtn) plannerBtn.style.setProperty("display", "none", "important");
    if (summaryBtn) {
      summaryBtn.style.setProperty("display", "inline-flex", "important");
      if (typeof window.mcRefreshProductSummaryButton === "function") window.mcRefreshProductSummaryButton();
    }
  }

  function bindSectionalLeatherUiRetries() {
    if (!document.documentElement.classList.contains("is-sectional-product")) return;
    var hdr = document.getElementById("mcLeatherHeader");
    var btn = document.getElementById("mcLeatherBtn");
    var row = document.getElementById("mcLeatherHeaderRow");
    function openModal(ev) {
      if (typeof window.mcOpenWmLeatherModal === "function") {
        window.mcOpenWmLeatherModal(ev || { preventDefault: function () {}, stopPropagation: function () {} });
      }
    }
    if (btn && btn.dataset.mtlSectionalLeatherBound !== "1") {
      btn.dataset.mtlSectionalLeatherBound = "1";
      btn.addEventListener("click", openModal);
    }
    if (hdr && hdr.dataset.mtlSectionalLeatherBound !== "1") {
      hdr.dataset.mtlSectionalLeatherBound = "1";
      hdr.addEventListener("click", openModal);
    }
    if (row && row.dataset.mtlSectionalLeatherBound !== "1") {
      row.dataset.mtlSectionalLeatherBound = "1";
      row.addEventListener("click", function (e) {
        if (e.target && e.target.closest && e.target.closest("#mcLeatherBtn")) return;
        openModal(e);
      });
    }
    if (!document.documentElement.dataset.mtlWmLeatherReadyListen) {
      document.documentElement.dataset.mtlWmLeatherReadyListen = "1";
      document.addEventListener(
        "wmLeatherOptionsReady",
        function () {
          if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
        },
        false
      );
    }
    if (!document.documentElement.dataset.mtlLeatherRetryScheduled) {
      document.documentElement.dataset.mtlLeatherRetryScheduled = "1";
      [400, 1200, 2500, 5000, 9000].forEach(function (ms) {
        window.setTimeout(function () {
          if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
        }, ms);
      });
    }
  }

  function finalizeSectionalUi(section) {
    try {
      document.documentElement.classList.add("has-sectional-config-cards");
    } catch (eCls) {}
    removeStandaloneDuplicateProductSummary();
    var leatherSelNow = findNativeLeatherSelectEl();
    ensureLeatherOptionsFromNativeSelect(leatherSelNow);
    patchLeatherModalFallback(leatherSelNow);
    applyAlulaPalliserPdfHref();
    if (typeof window.mcRefreshProductSummaryButton === "function") {
      window.mcRefreshProductSummaryButton();
    }
    applyAlulaPalliserPdfHref();
    var legacyToggle = document.getElementById("mtl-sectional-more-native");
    if (legacyToggle) legacyToggle.remove();
    ensureProductSummary(section);
    ensureInlineProductSummaryVisibleWithPlannerHidden();
    scheduleMoveLeatherAboveConfigurations(section);
    scheduleHideConfigurationRow();
    scheduleSectionalAtcChrome();
    ensureMcWmOpenMountedListener();
    bindSectionalLeatherUiRetries();
    bindConfigurationCardClicks();
    ensureObservers();
    ensureMemberClassObserver();
    syncCardsSelectionHighlight();
    updateProductSummary();
    updateSectionalCardPriceBadges();
    if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
  }

  function renderSectionalPdp() {
    var misLeather = document.querySelectorAll("#v65-product-parent select.mc-native-leather, #options_table select.mc-native-leather");
    Array.prototype.forEach.call(misLeather, function (sel) {
      var rowText = "";
      var tr = sel.closest && sel.closest("tr");
      var td = sel.closest && sel.closest("td");
      if (tr) rowText += " " + tr.innerText;
      if (td) rowText += " " + td.innerText;
      rowText = rowText.toLowerCase();
      if (
        /choose\s+configuration|^configuration\b|choose\s+seat\b/i.test(rowText) &&
        !/(choose\s+cover|choose\s+leather|select\s+leather|select\s+a\s+leather)/i.test(rowText)
      ) {
        sel.classList.remove("mc-native-leather");
      }
    });

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
      var csCheck = findConfigurationSelect();
      if (csCheck) {
        var nReal = Array.from(csCheck.options).filter(function (o) {
          return !isPlaceholderConfigOption(o);
        }).length;
        var nCards = secExistingEarly.querySelectorAll(".mtl-sectional-card").length;
        if (nReal !== nCards) {
          secExistingEarly.removeAttribute("data-mtl-final-init");
          sectionalLog("sectional rebuild: option count", nReal, "cards", nCards);
        }
      }
    }
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

    var merged = mergeNativeOptionsWithJson(configSelect, jsonFromKey, productKey, pcVal);
    console.log("[MTL] mergeNativeOptionsWithJson result count:", merged.length, merged);
    if (!merged.length) {
      console.warn("No Volusion configuration options to display as cards.", productKey);
      return;
    }

    (function orderDefaultConfigurationFirst() {
      var selVal = String(configSelect.value || "");
      var defI = -1;
      var i;
      for (i = 0; i < merged.length; i++) {
        if (String(merged[i].nativeValue) === selVal) {
          defI = i;
          break;
        }
      }
      if (defI < 0) {
        defI = merged.findIndex(function (c) {
          return c.base === true;
        });
      }
      if (defI < 0) {
        defI = merged.findIndex(function (c) {
          return normalizeCode(c.code) === "07-15";
        });
      }
      if (defI < 0) defI = 0;
      var first = merged[defI];
      var rest = merged.filter(function (_, j) {
        return j !== defI;
      });
      merged.length = 0;
      merged.push.apply(merged, [first].concat(rest));
    })();

    try {
      document.documentElement.classList.add("is-sectional-product");
    } catch (eSecHtml) {}

    state.cfgByCode = {};
    state.cfgByNativeValue = {};
    merged.forEach(function (c) {
      if (c && c.code) state.cfgByCode[normalizeCode(c.code)] = c;
      if (c && c.nativeValue != null) state.cfgByNativeValue[String(c.nativeValue)] = c;
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
      if (cfg.priceDiff != null && cfg.priceDiff !== "") {
        card.setAttribute("data-mtl-price-diff", String(cfg.priceDiff));
      }

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

    var baseConfig = merged[0];

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

  function boot() {
    ensureMcWmOpenMountedListener();
    if (shouldRunSectionalDiagnostics()) {
      window.setTimeout(function () {
        runMtlSectionalDiagnostic("after DOMContentLoaded (0ms tick)");
      }, 0);
      window.setTimeout(function () {
        runMtlSectionalDiagnostic("t+1500ms");
      }, 1500);
    }
    runRender();
    setTimeout(runRender, 400);
    setTimeout(runRender, 1200);
    setTimeout(runRender, 2800);
  }

  if (document.readyState !== "loading") boot();
  else
    document.addEventListener("DOMContentLoaded", function () {
      boot();
    });
  window.addEventListener("load", runRender);
})();
