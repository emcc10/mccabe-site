/**
 * Sectional PDP: configuration diagrams, native select sync, product summary.
 * Diagnostics: window.MTL_RENDERER_BUILD (see console on load).
 */
(function () {
  "use strict";

  var IMG_V = "sectional-diagrams-github-raw-v3";

  window.MTL_LEATHER_LOCK = window.MTL_LEATHER_LOCK || {
    nativeSelectPinned: false,
    swatchesRendered: false,
    handlersBound: false,
    observerBound: false,
  };

  /**
   * Diagram PNGs load from GitHub (same files as in-repo vspfiles/sectional-diagrams/).
   * After you push to main, the live site picks up new images without Volusion file uploads.
   * Optional override (must end with /): window.MTL_SECTIONAL_DIAGRAM_BASE = "https://raw.githubusercontent.com/OWNER/REPO/branch/vspfiles/sectional-diagrams/";
   */
  var DEFAULT_MTL_SECTIONAL_DIAGRAM_BASE =
    "https://raw.githubusercontent.com/emcc10/mccabe-site/main/vspfiles/sectional-diagrams/";

  function sectionalDiagramImageBase() {
    try {
      var o = typeof window !== "undefined" ? window.MTL_SECTIONAL_DIAGRAM_BASE : null;
      if (o != null) {
        var t = String(o).trim();
        if (t) return t.replace(/\/?$/, "/");
      }
    } catch (eBase) {}
    return DEFAULT_MTL_SECTIONAL_DIAGRAM_BASE;
  }

  /** Volusion path, basename, or full https URL → final img src (before ?v= cache-bust). */
  function resolveSectionalDiagramAssetUrl(pathOrUrl) {
    var s = String(pathOrUrl || "").trim();
    if (!s) return "";
    var lc = s.toLowerCase();
    if (lc.indexOf("https://") === 0 || lc.indexOf("http://") === 0) return s;
    var legacy = "/v/vspfiles/sectional-diagrams/";
    if (s.indexOf(legacy) === 0) {
      s = s.slice(legacy.length);
    } else {
      var marker = "sectional-diagrams/";
      var mi = s.indexOf(marker);
      if (mi !== -1) s = s.slice(mi + marker.length);
    }
    s = s.replace(/^\/+/, "");
    if (!s) return "";
    return sectionalDiagramImageBase() + s;
  }

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

  /** Full-screen diagram preview (one shared node on <body>). */
  var __mtlSectionalLbEl = null;
  var __mtlSectionalLbEscBound = false;
  var __mtlSectionalLbPopstateBound = false;

  window.MTL_RENDERER_VERSION = "sectional-leather-20260520-v2";
  window.MTL_RENDERER_BUILD = "sectional-20260516-leather-idempotent-v20";

  /** Template owns native leather `<select>` discovery; prefers __McCabeLeatherCollectImpl so `mcCollectNativeLeatherSelectsForPdp` can’t be swapped by other scripts */
  function mtlGetNativeLeatherCollectFn() {
    if (typeof window.__McCabeLeatherCollectImpl === "function") return window.__McCabeLeatherCollectImpl;
    if (typeof window.mcCollectNativeLeatherSelectsForPdp === "function") return window.mcCollectNativeLeatherSelectsForPdp;
    return null;
  }
  console.log("MTL_RENDERER_BUILD", window.MTL_RENDERER_BUILD);

  /** Set true only after configuration cards mount succeeded; `hideConfigurationRow` no-ops until then. */
  window.__mtlReplacementRenderSucceeded = window.__mtlReplacementRenderSucceeded || false;

  var __mtlDiag =
    window.__mtlDiag ||
    {
      page: "—",
      configData: "NO",
      configCards: "NO",
      pricingBox: "NO",
      productSummary: "NO",
      leatherOpts: "NO",
      leatherModal: "NO",
      miniSwatches: "NO",
      leatherDebug: "—",
    };
  window.__mtlDiag = __mtlDiag;

  function ensureMtlStageTrackerDom() {
    /* Debug overlay removed — diagnostics still available via window.__mtlDiag in the console */
  }

  function mtlRefreshStageTrackerDom() {
    var el = document.getElementById("mtl-sectional-stage-tracker");
    if (!el) return;
    var d = __mtlDiag;
    el.textContent =
      "BUILD: " +
      String(window.MTL_RENDERER_BUILD || "") +
      "\nPAGE DETECTED: " +
      String(d.page || "—") +
      "\nCONFIG DATA FOUND: " +
      String(d.configData || "—") +
      "\nCONFIG CARDS RENDERED: " +
      String(d.configCards || "—") +
      "\nPRICING BOX RENDERED: " +
      String(d.pricingBox || "—") +
      "\nPRODUCT SUMMARY RENDERED: " +
      String(d.productSummary || "—") +
      "\nLEATHER OPTIONS FOUND: " +
      String(d.leatherOpts || "—") +
      "\nLEATHER MODAL RENDERED: " +
      String(d.leatherModal || "—") +
      "\nMINI SWATCHES RENDERED: " +
      String(d.miniSwatches || "—") +
      "\nLEATHER DEBUG: " +
      String(d.leatherDebug || "—");
  }

  function detectPageKindForMtlDiagnostics() {
    if (isTheaterSeatingProductPageForGuard()) return "THEATER";
    try {
      if (typeof window.isSectionalProductPage === "function" && window.isSectionalProductPage()) return "SECTIONAL";
    } catch (eS) {}
    if (document.documentElement.classList.contains("is-sectional-product")) return "SECTIONAL";
    if (document.getElementById("v65-product-parent")) return "SOFA";
    return "UNKNOWN";
  }

  function mtlRunStage(stageLogName, fn) {
    console.log("[MTL] START " + stageLogName);
    try {
      var r = fn();
      console.log("[MTL] SUCCESS " + stageLogName);
      return r;
    } catch (err) {
      console.error("[MTL] FAILURE " + stageLogName, err);
      if (err && err.stack) console.error(err.stack);
      return { __mtlErr: err };
    }
  }

  /** Palliser theater PDPs: never run sectional leather/cards/summary relocation. */
  function isTheaterSeatingProductPageForGuard() {
    /* Sectional PDPs often include “Theater seating” nav / cross-sell copy in v65-product-parent — must not trigger theater guard. */
    try {
      if (document.documentElement.classList.contains("is-sectional-product")) return false;
    } catch (eH) {}
    try {
      if (typeof window.isSectionalProductPage === "function" && window.isSectionalProductPage()) return false;
    } catch (eS) {}
    var path = String(location.pathname || "").toLowerCase();
    if (path.indexOf("-sc-") !== -1) return false;
    try {
      var pcG = document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      var pcGu = pcG ? String(pcG.value || "").toLowerCase() : "";
      if (pcGu.indexOf("-sc-") !== -1) return false;
    } catch (ePc) {}

    try {
      if (document.body && document.body.classList.contains("mc-theater-seating-pdp")) return true;
    } catch (eB) {}
    if (
      path.indexOf("theater-seating") !== -1 ||
      path.indexOf("theatre-seating") !== -1 ||
      path.indexOf("customtheaterseating") !== -1 ||
      path.indexOf("home-theater") !== -1 ||
      path.indexOf("home-theatre") !== -1
    ) {
      return true;
    }
    var blob = "";
    try {
      var pr = document.getElementById("v65-product-parent");
      var prodSlice = pr ? String(pr.innerText || "").slice(0, 10000) : "";
      if (!prodSlice && document.body) prodSlice = String(document.body.innerText || "").slice(0, 5000);
      blob = (path + " " + String(document.title || "") + " " + prodSlice).toLowerCase();
    } catch (eBl) {}
    if (
      /\btheater seating\b|\btheatre seating\b|\bhome theater\b|\bhome theatre\b/.test(blob)
    ) {
      if (
        path.indexOf("theater") !== -1 ||
        path.indexOf("theatre") !== -1 ||
        path.indexOf("customtheater") !== -1
      ) {
        return true;
      }
    }
    return false;
  }

  function stripSectionalHtmlClassIfTheater() {
    if (!isTheaterSeatingProductPageForGuard()) return;
    try {
      document.documentElement.classList.remove("is-sectional-product");
    } catch (eR) {}
  }

  function isSectionalProductPageClient() {
    if (isTheaterSeatingProductPageForGuard()) return false;
    if (typeof window.isSectionalProductPage === "function" && window.isSectionalProductPage()) return true;
    if (document.documentElement.classList.contains("is-sectional-product")) return true;
    try {
      var path = String(window.location.pathname || "").toLowerCase();
      if (path.indexOf("room-planner") === -1 && path.includes("-sc-")) return true;
      var pcEl = document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      var pcVal = pcEl ? String(pcEl.value || "").trim() : "";
      if (/-sc-/i.test(pcVal)) return true;
    } catch (ePath) {}
    return false;
  }

  /** Ensure #mcLeatherSwatchStrip exists (template mount or accordion host). */
  function ensureSectionalLeatherStripDom() {
    var strip = document.getElementById("mcLeatherSwatchStrip");
    if (strip) return strip;

    if (typeof window.mcMountInlineConfig === "function") {
      try {
        window.mcMountInlineConfig({ forceWithoutWmOpen: true });
      } catch (eMount) {}
      strip = document.getElementById("mcLeatherSwatchStrip");
      if (strip) return strip;
    }

    if (typeof window.mcBuildPdpAccordion === "function") {
      try {
        window.mcBuildPdpAccordion();
      } catch (eAcc) {}
    }

    var host = document.querySelector("#mc-acc-row-leather .mc-acc-leather-host");
    var picker = document.getElementById("mcLeatherPicker");
    if (!picker) {
      picker = document.createElement("div");
      picker.id = "mcLeatherPicker";
      picker.style.cssText =
        "display:flex;align-items:center;gap:6px;width:100%;margin:0;padding:0";
    }
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "mcLeatherSwatchStrip";
      strip.style.cssText =
        "display:flex;flex-wrap:nowrap;align-items:stretch;gap:6px;flex:1 1 auto;min-width:0;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch";
      if (!picker.contains(strip)) picker.appendChild(strip);
    }
    if (host && picker.parentNode !== host) {
      host.appendChild(picker);
    } else if (!picker.parentNode) {
      var inline = document.getElementById("mc-inline-config") || document.getElementById("mcLeatherRow");
      if (inline) inline.appendChild(picker);
      else {
        var optTd =
          document.querySelector("#v65-product-parent #options_table td") ||
          document.querySelector("#options_table td");
        if (optTd) optTd.insertBefore(picker, optTd.firstChild);
      }
    }
    return document.getElementById("mcLeatherSwatchStrip");
  }

  function syncSectionalLeatherAccordionHost() {
    if (typeof window.mcBuildPdpAccordion === "function") {
      try {
        window.mcBuildPdpAccordion();
      } catch (eRun) {}
    }
    var host = document.querySelector("#mc-acc-row-leather .mc-acc-leather-host");
    if (!host) return;
    var picker = document.getElementById("mcLeatherPicker");
    var strip = document.getElementById("mcLeatherSwatchStrip");
    if (picker && strip && !picker.contains(strip)) picker.appendChild(strip);
    var move = picker || strip;
    if (move && !host.contains(move)) host.appendChild(move);
  }

  /** Minimal #wmSections shell so sectional modal injection can run if template initIfReady has not fired yet. */
  function ensureSectionalWmLeatherModalShell() {
    var ws = document.getElementById("wmSections");
    if (ws) return ws;
    var overlay = document.querySelector(".wm-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "wm-overlay";
      overlay.style.display = "none";
      var modalEl = document.createElement("div");
      modalEl.className = "wm-modal";
      modalEl.setAttribute("role", "dialog");
      modalEl.setAttribute("aria-modal", "true");
      var modalBodyEl = document.createElement("div");
      modalBodyEl.className = "wm-modal-body";
      var panelEl = document.createElement("div");
      panelEl.className = "wm-tabpanel";
      panelEl.setAttribute("data-active", "1");
      var wsEl = document.createElement("div");
      wsEl.id = "wmSections";
      panelEl.appendChild(wsEl);
      modalBodyEl.appendChild(panelEl);
      modalEl.appendChild(modalBodyEl);
      overlay.appendChild(modalEl);
      document.body.appendChild(overlay);
    }
    ws = document.getElementById("wmSections");
    if (!ws && overlay) {
      var body = overlay.querySelector(".wm-modal-body");
      if (body) {
        ws = document.createElement("div");
        ws.id = "wmSections";
        body.appendChild(ws);
      }
    }
    return ws;
  }

  function findPdpAddToCartAnchor() {
    var scope = document.getElementById("v65-product-parent") || document.getElementById("content_area") || document;
    var atcRow = scope.querySelector(".mc-atc-row");
    if (atcRow && atcRow.parentNode) return { parent: atcRow.parentNode, before: atcRow };
    var wrap = scope.querySelector(".mc-atc-button-wrap");
    if (wrap && wrap.parentNode) return { parent: wrap.parentNode, before: wrap };
    var btn =
      scope.querySelector('.mc-atc-button-wrap input[name="btnaddtocart"], .mc-atc-button-wrap button[name="btnaddtocart"]') ||
      scope.querySelector('input[name="btnaddtocart"]') ||
      scope.querySelector('button[name="btnaddtocart"]') ||
      scope.querySelector('input[id*="btnaddtocart" i]');
    if (!btn) return null;
    var wrapBtn = btn.closest(".mc-atc-button-wrap");
    if (wrapBtn && wrapBtn.parentNode) return { parent: wrapBtn.parentNode, before: wrapBtn };
    var qty =
      scope.querySelector(".v65-productdetail-cartqty") ||
      scope.querySelector(".vol-cartqty__wrap");
    if (qty && qty.parentNode) return { parent: qty.parentNode, before: qty };
    var tr = btn.closest("tr");
    if (tr && tr.parentNode) return { parent: tr.parentNode, before: tr };
    if (btn.parentNode) return { parent: btn.parentNode, before: btn };
    return null;
  }

  function mountProductSummaryAboveAtc(sum) {
    if (!sum || !isSectionalProductPageClient()) return;

    try {
      sum.classList.add("mtl-product-summary--above-atc");
      sum.style.setProperty("display", "block", "important");
      sum.style.setProperty("visibility", "visible", "important");
    } catch (eCls) {}

    function tryInsert(anchor) {
      if (!anchor || !anchor.parent) return false;
      try {
        anchor.parent.insertBefore(sum, anchor.before);
        return true;
      } catch (eIns) {
        console.warn("[MTL] mountProductSummaryAboveAtc insertBefore", eIns);
        return false;
      }
    }

    if (tryInsert(findPdpAddToCartAnchor())) return;

    var acc = document.getElementById("mc-pdp-accordion");
    if (acc && acc.parentNode) {
      try {
        acc.parentNode.insertBefore(sum, acc.nextSibling);
        return;
      } catch (eAcc) {
        console.warn("[MTL] mountProductSummaryAboveAtc fallback after accordion", eAcc);
      }
    }

    var optionsTd =
      document.querySelector("#v65-product-parent #options_table td") ||
      document.querySelector("#options_table td");
    if (optionsTd) {
      try {
        var atcInput = optionsTd.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
        var atcTr = atcInput && atcInput.closest ? atcInput.closest("tr") : null;
        if (atcTr && atcTr.parentNode) {
          atcTr.parentNode.insertBefore(sum, atcTr);
        } else {
          optionsTd.appendChild(sum);
        }
        return;
      } catch (eTd) {
        console.warn("[MTL] mountProductSummaryAboveAtc options td fallback", eTd);
      }
    }

    if (!sum.parentNode) {
      var section = document.getElementById("mtl-sectional-configurations");
      if (section && section.parentNode) {
        try {
          section.parentNode.insertBefore(sum, section.nextSibling);
        } catch (eSec) {}
      }
    }
  }
  window.mountProductSummaryAboveAtc = mountProductSummaryAboveAtc;

  function isVolusionConfigurationRowSelect(sel) {
    try {
      var rowText = "";
      var tr = sel.closest("tr");
      var td = sel.closest("td");
      if (tr) rowText += " " + tr.innerText;
      if (td) rowText += " " + td.innerText;
      if (sel.parentElement) rowText += " " + sel.parentElement.innerText;
      rowText = rowText.toLowerCase();
      if (/(choose cover|choose leather|select leather|select a leather|select\s+a\s+leather|upholstery|fabric cover|\bselect\s+cover\b|\bcover\s*:\b|\bleather\s*:\b|\bgrade\b)/i.test(rowText))
        return false;

      var optSample = "";
      var oi;
      var ol = sel.options ? sel.options.length : 0;
      for (oi = 0; oi < Math.min(ol, 30); oi++) {
        optSample += " " + String(sel.options[oi].textContent || "").toLowerCase();
      }
      if (
        /\bgrade\b/.test(optSample) &&
        /leather|nubuck|fabric|vinyl|microfiber|poly|polyurethane|boucle|chenille|velvet|wool|tweed/i.test(optSample) &&
        !/sectional configuration|choose configuration/i.test(optSample)
      ) {
        return false;
      }

      if (
        !/choose\s+configuration|choose\s+seat\b|select\s+configuration/i.test(rowText) &&
        !/\bconfiguration\s*:/i.test(rowText)
      )
        return false;
      if (/(upholstery|leather|fabric cover)(?![a-z])/i.test(rowText) && !/choose\s+configuration/i.test(rowText)) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Row + associated <label for="…"> text for option-row heuristics (label is often outside the same <tr> Volusion prints). */
  function getVolusionOptionRowContextLower(sel) {
    var parts = [];
    try {
      var tr = sel.closest("tr");
      var td = sel.closest("td");
      if (tr) parts.push(String(tr.innerText || ""));
      if (td) parts.push(String(td.innerText || ""));
      if (sel.id) {
        var idEsc =
          typeof CSS !== "undefined" && typeof CSS.escape === "function"
            ? CSS.escape(String(sel.id))
            : String(sel.id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        var lab = document.querySelector('label[for="' + idEsc + '"]');
        if (lab) parts.push(String(lab.textContent || ""));
      }
    } catch (eCtx) {}
    return String(parts.join(" ")).toLowerCase().replace(/\s+/g, " ").trim();
  }

  /** Never treat Volusion hidden smart-match price dumps as leather DOM (aligned with wm-leather __McCabeRejectLeatherSourceSelect). */
  function mtlRejectAsLeatherSource(sel) {
    if (!sel) return false;
    if (typeof window.__McCabeRejectLeatherSourceSelect === "function") {
      try {
        return !!window.__McCabeRejectLeatherSourceSelect(sel);
      } catch (eRJ) {}
    }
    try {
      if (sel.classList && sel.classList.contains("v65-hidden-option-cat-vals")) return true;
    } catch (eC) {}
    return false;
  }

  function findNativeLeatherSelectEl() {
    try {
      if (window.MTL_LEATHER_LOCK && window.MTL_LEATHER_LOCK.nativeSelectPinned) {
        var earlyPinned = document.querySelector(".mc-native-leather");
        if (earlyPinned) return earlyPinned;
      }
    } catch (eEarlyPin) {}

    var configSel = null;
    try {
      configSel = findConfigurationSelect();
    } catch (eCfg) {}

    var sels = [];
    function pushUniqueSels(nodeList) {
      var j;
      for (j = 0; j < nodeList.length; j++) {
        var node = nodeList[j];
        if (!node || sels.indexOf(node) !== -1) continue;
        sels.push(node);
      }
    }
    pushUniqueSels(
      document.querySelectorAll(
        "#options_table select, #v65-product-parent select, #content_area table[id*='options_table'] select, table[id*='options_table'] select"
      )
    );
    try {
      var atcForm =
        document.querySelector('form[action*="ProductDetails"]') ||
        document.querySelector('form[action*="productdetails"]') ||
        document.querySelector('form[action*="shoppingcart"]');
      if (atcForm) pushUniqueSels(atcForm.querySelectorAll("select"));
    } catch (eForm) {}
    var i;
    var pinned = document.querySelector("select.mc-native-leather");
    if (pinned && (isVolusionConfigurationRowSelect(pinned) || mtlRejectAsLeatherSource(pinned))) {
      try {
        pinned.classList.remove("mc-native-leather");
      } catch (eUnpin) {}
      pinned = null;
    }

    /*
     * Canonical list from wm-leather-modal-js. Pinned mc-native-leather counts only when it appears in that list.
     */
    var collectFn = mtlGetNativeLeatherCollectFn();
    if (pinned && collectFn) {
      try {
        var pinList = collectFn();
        if (pinList && pinList.indexOf(pinned) !== -1) {
          console.log("[MTL] findNativeLeatherSelectEl: pinned mc-native-leather (collector-backed)");
          try {
            window.MTL_LEATHER_LOCK.nativeSelectPinned = true;
            console.log("[MTL] native leather select pinned once; skipping future re-pin");
          } catch (ePinOnce) {}
          return pinned;
        }
      } catch (ePx) {}
      try {
        pinned.classList.remove("mc-native-leather");
      } catch (eRp) {}
      pinned = null;
    }

    if (collectFn) {
      var canonList = collectFn();
      if (canonList && canonList.length) {
        var ci;
        for (ci = 0; ci < canonList.length; ci++) {
          var canonSel = canonList[ci];
          if (!canonSel) continue;
          if (mtlRejectAsLeatherSource(canonSel)) continue;
          if (isVolusionConfigurationRowSelect(canonSel)) continue;
          if (configSel && canonSel === configSel) continue;
          console.log("[MTL] findNativeLeatherSelectEl: __McCabeLeatherCollectImpl (canonical)");
          return canonSel;
        }
      }
    }

    /* Fallback when collector absent or upholstery row not classified yet — never hidden smart-match price fields */
    for (i = 0; i < sels.length; i++) {
      var sel = sels[i];
      if (isVolusionConfigurationRowSelect(sel)) continue;
      if (mtlRejectAsLeatherSource(sel)) continue;
      if (configSel && sel === configSel) continue;
      var rowText = getVolusionOptionRowContextLower(sel);
      if (
        /(choose cover|choose leather|select leather|select a leather|select\s+a\s+leather|upholstery|cover|fabric|grade|swatch|palliser|material|color\s*choice)/i.test(
          rowText
        )
      ) {
        return sel;
      }
    }

    return null;
  }

  function isPlaceholderLeatherOption(opt) {
    var t = String(opt.textContent || "").replace(/\s+/g, " ").trim();
    var v = String(opt.value || "").trim();
    if (!t) return true;
    if (!v && /^(select|choose|please|--)/i.test(t)) return true;
    if (/^--+$|^[-–—]$/.test(t)) return true;
    if (/please\s+select/i.test(t)) return true;
    if (/^select\s*(\.\.\.|…)?$/i.test(t)) return true;
    if (/^select\s+one\b/i.test(t)) return true;
    if (/^select\s+from(\s+the)?\s+list\b/i.test(t)) return true;
    if (/^select\s+a\s+(leather|cover|fabric|grade)\b/i.test(t)) return true;
    if (/^choose\s*(\.\.\.|…)?$/i.test(t)) return true;
    if (/^choose\s+(one|option|your|from|below)\b/i.test(t)) return true;
    if (
      /\bgrade\b|\bleather\b|\bfabric\b|\bnubuck\b|\baniline\b|\bvinyl\b|\bmicrofiber\b|\bchenille\b|\bvelvet\b|\bcowhide\b|\boucle\b|\bwool\b|\bfaux\b/i.test(
        t
      )
    )
      return false;
    if (/\d/.test(t) && /[a-z]{2,}/i.test(t)) return false;
    if (/^choose\b/i.test(t)) return t.length < 48;
    return false;
  }

  /** Pull a display name + grade line from Volusion option text (avoids dumping raw "Grade ####" as the only label). */
  function parseLeatherFromVolusionOption(opt) {
    var full = String(opt.textContent || "").replace(/\s+/g, " ").trim();
    var gradeLine = "—";
    var gm = full.match(/\b(?:Grade|Gr\.?)\s*([0-9][0-9,\s]*(?:\/\s*[0-9][0-9,\s]*)?)\b/i);
    if (gm) {
      gradeLine = "Grade " + String(gm[1] || "").replace(/\s+/g, "").trim();
    }
    var name = full;
    if (gm) {
      name = full
        .replace(/\b(?:Grade|Gr\.?)\s*[0-9][0-9,\s]*(?:\/\s*[0-9][0-9,\s]*)?\b/i, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!name) name = full;
    return { fullLabel: full, name: name, grade: gradeLine };
  }

  function buildSyntheticWmLeatherOptionsFromSelect(sel) {
    if (!sel || !sel.options) return [];
    var out = [];
    Array.prototype.forEach.call(sel.options, function (opt) {
      if (isPlaceholderLeatherOption(opt)) return;
      var value = String(opt.value || "").trim();
      var parsed = parseLeatherFromVolusionOption(opt);
      out.push({
        family: parsed.name,
        color: "",
        grade: parsed.grade,
        value: value,
        swatches: [],
        label: parsed.fullLabel,
      });
    });
    return out;
  }

  function mtlSplitLeatherFamilyColor(label) {
    var t = String(label || "").replace(/\s+/g, " ").trim();
    if (!t) return { family: "", color: "" };
    var gm = t.match(/\b(?:Grade|Gr\.?)\s*([0-9][0-9,\s]*(?:\/\s*[0-9][0-9,\s]*)?)\b/i);
    if (gm) {
      t = t
        .replace(/\b(?:Grade|Gr\.?)\s*[0-9][0-9,\s]*(?:\/\s*[0-9][0-9,\s]*)?\b/i, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    var parts = t.split(/\s+/).filter(Boolean);
    if (!parts.length) return { family: "", color: "" };
    return { family: parts[0], color: parts.slice(1).join(" ") };
  }

  function mtlSyncNativeSelectToWmOptions(leatherSel) {
    if (!leatherSel || !leatherSel.options) return;
    var syn = buildSyntheticWmLeatherOptionsFromSelect(leatherSel);
    if (!syn.length) return;
    window.__WM_LEATHER_OPTIONS__ = syn.map(function (s) {
      var fc = mtlSplitLeatherFamilyColor(s.label || s.family || "");
      var family = fc.family || String(s.family || "").trim();
      var color = fc.color || "";
      return {
        family: family,
        color: color,
        grade: s.grade,
        value: s.value,
        label: s.label,
        swatches: buildSwatchUrls(family, color),
      };
    });
    try {
      document.dispatchEvent(new CustomEvent("wmLeatherOptionsReady", { bubbles: true }));
    } catch (eEvt) {}
  }

  function ensureLeatherOptionsFromNativeSelect(leatherSel) {
    if (isSectionalProductPageClient()) {
      if (typeof window.mcTryInitWmLeather === "function") {
        window.mcTryInitWmLeather();
      }
      var wm = Array.isArray(window.__WM_LEATHER_OPTIONS__) ? window.__WM_LEATHER_OPTIONS__ : [];
      var needsNative =
        !wm.length ||
        wm.every(function (o) {
          return !o || !o.swatches || !o.swatches.length;
        });
      if (needsNative) {
        var le = leatherSel || findNativeLeatherSelectEl();
        if (le) mtlSyncNativeSelectToWmOptions(le);
      }
      return;
    }
    if (!leatherSel || !leatherSel.options || leatherSel.options.length < 1) return;
    var syn = buildSyntheticWmLeatherOptionsFromSelect(leatherSel);
    if (!syn.length) return;
    var prev = Array.isArray(window.__WM_LEATHER_OPTIONS__) ? window.__WM_LEATHER_OPTIONS__ : null;
    var prevLen = prev ? prev.length : 0;
    var prevHasSwatches = !!(prev && prev.some(function (p) { return p && p.swatches && p.swatches.length; }));

    var useSyn =
      !prevLen ||
      syn.length > prevLen ||
      (!prevHasSwatches && prevLen > 0 && prev.every(function (p) { return !p || !p.swatches || !p.swatches.length; }));

    if (!useSyn) return;

    window.__WM_LEATHER_OPTIONS__ = syn;
    try {
      document.dispatchEvent(new CustomEvent("wmLeatherOptionsReady", { bubbles: true }));
    } catch (eEvt) {}
    console.log("[MTL] __WM_LEATHER_OPTIONS__ set from native leather <select>, count=", syn.length);
  }

  function wmLeatherOptionsLookCorrupt(opts) {
    if (!opts || !opts.length) return false;
    var bad = 0;
    var i;
    for (i = 0; i < opts.length; i++) {
      var o = opts[i];
      if (!o) continue;
      var f = String(o.family || "").trim();
      var lab = String(o.label || "").trim();
      if (/^\$?\s*[\d,]+\.?\d*\s*$/.test(f) || /^\$?\s*[\d,]+\.?\d*\s*$/.test(lab)) bad++;
    }
    return bad >= Math.min(2, opts.length);
  }

  /** Tear down stale theater leather UI so initIfReady re-parses after Volusion injects new cover options. */
  function mtlRebuildTheaterLeatherUi() {
    if (!isSectionalProductPageClient()) return;
    try {
      window.__WM_LEATHER_MODAL_BUILT__ = false;
    } catch (eFlag) {}
    try {
      window.__WM_LEATHER_OPTIONS__ = [];
    } catch (eOpt) {}
    var wmOpen = document.getElementById("wmOpen");
    if (wmOpen) {
      var uiBlock = wmOpen.parentElement;
      if (uiBlock && uiBlock.querySelector && uiBlock.querySelector("#wmSummary")) {
        uiBlock.remove();
      } else {
        wmOpen.remove();
      }
    }
    var overlays = document.querySelectorAll("body > .wm-overlay");
    var oi;
    for (oi = 0; oi < overlays.length; oi++) {
      if (overlays[oi].querySelector("#wmSections")) overlays[oi].remove();
    }
    if (typeof window.mcTryInitWmLeather === "function") {
      window.mcTryInitWmLeather();
    }
    try {
      window.MTL_LEATHER_LOCK.swatchesRendered = false;
      window.MTL_LEATHER_LOCK.nativeSelectPinned = false;
      var stripR = document.getElementById("mcLeatherSwatchStrip");
      if (stripR && stripR.dataset) delete stripR.dataset.mtlSwatchesRendered;
    } catch (eLockReset) {}
  }

  /**
   * Calls template mcRenderLeatherPreviewStrip once per PDP strip (avoids repeated img GETs / flicker).
   * Pass force=true after user picks a leather so selection highlighting can refresh without stripping locks first.
   */
  function mtlInvokeRenderLeatherPreviewStrip(force) {
    force = !!force;
    var strip = document.querySelector("#mcLeatherSwatchStrip");
    if (!strip) {
      console.warn("[MTL] swatch render skipped: #mcLeatherSwatchStrip missing");
      return;
    }
    if (
      !force &&
      window.MTL_LEATHER_LOCK.swatchesRendered &&
      strip.children.length > 0
    ) {
      return;
    }
    if (
      !force &&
      strip.dataset.mtlSwatchesRendered === "true" &&
      strip.children.length > 0
    ) {
      window.MTL_LEATHER_LOCK.swatchesRendered = true;
      return;
    }
    if (typeof window.mcRenderLeatherPreviewStrip !== "function") return;
    window.mcRenderLeatherPreviewStrip();
    if (strip.children.length > 0) {
      strip.dataset.mtlSwatchesRendered = "true";
      window.MTL_LEATHER_LOCK.swatchesRendered = true;
      console.log("[MTL] leather swatches rendered once:", strip.children.length);
    }
  }

  /** Sectionals use the same theater leather pipeline (initIfReady → __WM_LEATHER_OPTIONS__ → mcRenderLeatherPreviewStrip). */
  function mtlRefreshSectionalLeatherUi() {
    if (!isSectionalProductPageClient()) return;
    ensureSectionalLeatherStripDom();
    syncSectionalLeatherAccordionHost();

    var strip = document.querySelector("#mcLeatherSwatchStrip");
    if (!strip) {
      console.warn("[MTL] swatch render skipped: #mcLeatherSwatchStrip missing");
      return;
    }
    if (
      window.MTL_LEATHER_LOCK.swatchesRendered &&
      strip.children.length > 0
    ) {
      try {
        __mtlDiag.leatherOpts = document.querySelector(".mc-native-leather") ? "YES" : "NO";
        __mtlDiag.miniSwatches = "YES";
        __mtlDiag.leatherModal = document.getElementById("wmOpen") ? "YES" : "NO";
        mtlRefreshStageTrackerDom();
      } catch (eDiagEarly) {}
      if (typeof window.mcSyncLeatherSummary === "function") {
        window.mcSyncLeatherSummary();
      }
      return;
    }
    if (
      strip.dataset.mtlSwatchesRendered === "true" &&
      strip.children.length > 0
    ) {
      window.MTL_LEATHER_LOCK.swatchesRendered = true;
      try {
        __mtlDiag.leatherOpts = document.querySelector(".mc-native-leather") ? "YES" : "NO";
        __mtlDiag.miniSwatches = "YES";
        __mtlDiag.leatherModal = document.getElementById("wmOpen") ? "YES" : "NO";
        mtlRefreshStageTrackerDom();
      } catch (eDiagDs) {}
      if (typeof window.mcSyncLeatherSummary === "function") {
        window.mcSyncLeatherSummary();
      }
      return;
    }

    var le = findNativeLeatherSelectEl();
    if (le) {
      ensureLeatherOptionsFromNativeSelect(le);
    }
    var wm = Array.isArray(window.__WM_LEATHER_OPTIONS__) ? window.__WM_LEATHER_OPTIONS__ : [];
    if (wmLeatherOptionsLookCorrupt(wm)) {
      mtlRebuildTheaterLeatherUi();
    } else if (typeof window.mcTryInitWmLeather === "function") {
      window.mcTryInitWmLeather();
    }
    if (typeof window.mcHostLeatherStripInsideAccordion === "function") {
      window.mcHostLeatherStripInsideAccordion();
    }
    mtlInvokeRenderLeatherPreviewStrip(false);
    var stripAfter = document.getElementById("mcLeatherSwatchStrip");
    var nAfter = stripAfter
      ? stripAfter.querySelectorAll(".mc-leather-mini-swatch, .mc-mini-swatch").length
      : 0;
    if (!nAfter) {
      if (typeof window.mcTryInitWmLeather === "function") {
        window.mcTryInitWmLeather();
      }
      if (typeof window.mcHostLeatherStripInsideAccordion === "function") {
        window.mcHostLeatherStripInsideAccordion();
      }
      mtlInvokeRenderLeatherPreviewStrip(false);
    }
    if (typeof window.mcSyncLeatherSummary === "function") {
      window.mcSyncLeatherSummary();
    }
    try {
      __mtlDiag.leatherOpts = le ? "YES" : "NO";
      var stripDiag = document.getElementById("mcLeatherSwatchStrip");
      var nMini = stripDiag
        ? stripDiag.querySelectorAll(".mc-leather-mini-swatch, .mc-mini-swatch").length
        : 0;
      __mtlDiag.miniSwatches = nMini > 0 ? "YES" : "NO";
      __mtlDiag.leatherModal = document.getElementById("wmOpen") ? "YES" : "NO";
      mtlRefreshStageTrackerDom();
    } catch (eDiag) {}
  }

  function mtlSyncSectionalLeatherFromDom() {
    mtlRefreshSectionalLeatherUi();
  }

  function installSectionalLeatherStripRenderer() {
    /* Sectionals use the same theater mini-swatch renderer (mcRenderLeatherPreviewStrip). */
  }

  /** Sectionals: same theater leather init + mini strip; only accordion host placement is sectional-specific. */
  function bootstrapSectionalLeatherUi() {
    if (!isSectionalProductPageClient()) return;
    mtlRemoveLeatherPickerHint();
    try {
      document.documentElement.classList.add("is-sectional-product");
    } catch (eCls) {}
    try {
      delete document.documentElement.dataset.mtlWmModalFallbackPatched;
    } catch (eDs) {}

    installSectionalLeatherStripRenderer();
    ensureSectionalLeatherStripDom();
    bindViewAllLeathersButtons();
    bindSectionalLeatherUiRetries();
    ensureSectionalOptionsTableLeatherObserver();
    ensureSectionalV65LeatherObserver();
    ensureSectionalAccordionLeatherObserver();

    if (typeof window.MTL_promptVolusionCoverOptions === "function") {
      window.MTL_promptVolusionCoverOptions();
    }
    mtlRefreshSectionalLeatherUi();

    if (!document.documentElement.dataset.mtlLeatherStripReadyListen) {
      document.documentElement.dataset.mtlLeatherStripReadyListen = "1";
      document.addEventListener(
        "wmLeatherOptionsReady",
        function () {
          var st = document.querySelector("#mcLeatherSwatchStrip");
          if (st && st.dataset.mtlSwatchesRendered === "true" && st.children.length > 0) {
            return;
          }
          mtlRefreshSectionalLeatherUi();
        },
        false
      );
    }
  }

  function scheduleSectionalLeatherBootstrap() {
    if (!isSectionalProductPageClient()) return;
    /* runRender/boot were each scheduling another full bootstrap+timeout ladder — stacking 5× Volusion-heavy work and freezing refreshes */
    if (window.__mtlLeatherBootstrapScheduled) return;
    window.__mtlLeatherBootstrapScheduled = true;

    bootstrapSectionalLeatherUi();
    if (!document.documentElement.dataset.mtlLeatherBootstrapDeferredOnce) {
      document.documentElement.dataset.mtlLeatherBootstrapDeferredOnce = "1";
      window.setTimeout(function () {
        var st = document.querySelector("#mcLeatherSwatchStrip");
        if (st && st.dataset.mtlSwatchesRendered === "true" && st.children.length > 0) return;
        if (typeof window.MTL_promptVolusionCoverOptions === "function") {
          window.MTL_promptVolusionCoverOptions();
        }
        bootstrapSectionalLeatherUi();
      }, 1200);
    }
  }
  window.scheduleSectionalLeatherBootstrap = scheduleSectionalLeatherBootstrap;
  window.mtlRefreshSectionalLeatherUi = mtlRefreshSectionalLeatherUi;

  function ensureSectionalOptionsTableLeatherObserver() {
    if (!isSectionalProductPageClient()) return;
    ensureSectionalV65LeatherObserver();
    if (document.documentElement.dataset.mtlOptsTblLeatherObs === "1") return;
    document.documentElement.dataset.mtlOptsTblLeatherObs = "1";
    var root = document.querySelector(
      "#v65-product-parent #options_table, #v65-product-parent table[id*='options_table'], #options_table, table[id*='options_table'], #content_area table[id*='options_table']"
    );
    if (!root || typeof MutationObserver === "undefined") return;
    var deb = null;
    var obs = new MutationObserver(function () {
      var stripChk = document.querySelector("#mcLeatherSwatchStrip");
      if (
        stripChk &&
        stripChk.dataset.mtlSwatchesRendered === "true" &&
        stripChk.children.length > 0
      ) {
        return;
      }
      if (deb) clearTimeout(deb);
      deb = setTimeout(function () {
        deb = null;
        mtlSyncSectionalLeatherFromDom();
      }, 200);
    });
    try {
      obs.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (eOb) {}
  }

  /** Volusion may inject the cover <select> after configuration changes outside #options_table; watch #v65-product-parent. */
  function ensureSectionalV65LeatherObserver() {
    if (!isSectionalProductPageClient()) return;
    if (document.documentElement.dataset.mtlV65LeatherObs === "1") return;
    document.documentElement.dataset.mtlV65LeatherObs = "1";
    var root = document.getElementById("v65-product-parent");
    if (!root || typeof MutationObserver === "undefined") return;
    var deb = null;
    var obs = new MutationObserver(function () {
      var stripChk = document.querySelector("#mcLeatherSwatchStrip");
      if (
        stripChk &&
        stripChk.dataset.mtlSwatchesRendered === "true" &&
        stripChk.children.length > 0
      ) {
        return;
      }
      if (deb) clearTimeout(deb);
      deb = setTimeout(function () {
        deb = null;
        mtlSyncSectionalLeatherFromDom();
      }, 220);
    });
    try {
      obs.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (eV65) {}
  }

  /** Accordion leather row mount — refresh strip until first successful raster (then observers no-op). */
  function ensureSectionalAccordionLeatherObserver() {
    if (!isSectionalProductPageClient()) return;
    if (window.MTL_LEATHER_LOCK.observerBound) return;
    var root = document.querySelector("#mc-acc-row-leather");
    if (!root || typeof MutationObserver === "undefined") return;
    window.MTL_LEATHER_LOCK.observerBound = true;
    try {
      var deb = null;
      new MutationObserver(function () {
        var strip = document.querySelector("#mcLeatherSwatchStrip");
        if (strip && strip.dataset.mtlSwatchesRendered === "true" && strip.children.length > 0) return;
        if (deb) clearTimeout(deb);
        deb = setTimeout(function () {
          deb = null;
          mtlRefreshSectionalLeatherUi();
        }, 120);
      }).observe(root, { childList: true, subtree: true });
    } catch (eAccMo) {
      window.MTL_LEATHER_LOCK.observerBound = false;
    }
  }

  function isWmOverlayVisible() {
    var ov = document.querySelector(".wm-overlay");
    if (!ov) return false;
    try {
      return window.getComputedStyle(ov).display !== "none" && window.getComputedStyle(ov).visibility !== "hidden";
    } catch (eC) {
      return false;
    }
  }

  function ensureWmSectionsFallbackObserver(leatherSel) {
    if (!isSectionalProductPageClient()) return;
    if (document.documentElement.dataset.mtlWmSecObs === "1") return;
    document.documentElement.dataset.mtlWmSecObs = "1";

    var deb = null;
    function scheduleFillFromMutation() {
      if (deb) clearTimeout(deb);
      deb = setTimeout(function () {
        deb = null;
        fillLeatherModalFromNativeSelect(leatherSel || findNativeLeatherSelectEl());
      }, 90);
    }

    function hook(ws) {
      if (!ws || ws.dataset.mtlFallbackObs === "1") return;
      ws.dataset.mtlFallbackObs = "1";
      var obs = new MutationObserver(function () {
        /* Only act when the overlay is actually open (display:flex), not just present in the DOM. */
        var ov = document.querySelector(".wm-overlay");
        if (!ov) return;
        var ovDisplay = (ov.style && ov.style.display) || window.getComputedStyle(ov).display;
        if (ovDisplay !== "flex") return;
        scheduleFillFromMutation();
      });
      try {
        obs.observe(ws, { childList: true, subtree: true });
      } catch (eO) {}
    }

    var ex = document.getElementById("wmSections");
    if (ex) hook(ex);
    var moDoc = new MutationObserver(function () {
      var ws = document.getElementById("wmSections");
      if (ws) {
        hook(ws);
        moDoc.disconnect();
      }
    });
    try {
      moDoc.observe(document.documentElement, { childList: true, subtree: true });
    } catch (eD) {}
  }

  function pickFirstSwatchUrl(o) {
    if (!o || !o.swatches || !o.swatches.length) return "";
    var i;
    var sw;
    var u;
    for (i = 0; i < o.swatches.length; i++) {
      sw = o.swatches[i];
      if (typeof sw === "string") u = String(sw).trim();
      else if (sw && typeof sw === "object") u = String(sw.url || sw.src || sw.image || sw.href || "").trim();
      else u = "";
      if (u) return u;
    }
    return "";
  }

  function wmRowForNativeValue(wm, val) {
    var vs = String(val);
    var i;
    for (i = 0; i < wm.length; i++) {
      if (wm[i] && String(wm[i].value) === vs) return wm[i];
    }
    return null;
  }

  /**
   * Sectional: WM may leave #wmSections with empty grade headers. Clear and inject native leather cards.
   * @returns {number} cards injected
   */
  function injectSectionalNativeLeatherModal(leatherSel) {
    try {
      if (!isSectionalProductPageClient() || !leatherSel) return 0;
      /* Allow inject even when overlay is not yet visible (called synchronously before display:flex is set). */
      ensureSectionalWmLeatherModalShell();
      var ws = document.getElementById("wmSections");
    if (!ws) {
      console.warn("[MTL leather modal] #wmSections not found");
      return 0;
    }
    /* Force the modal body and active tab panel to be visible.
       Volusion site-wide CSS may set display:none on .wm-modal-body or .wm-tabpanel.
       We always reapply because the modal may reopen after CSS changes. */
    try {
      var mb = ws.closest(".wm-modal-body");
      if (mb) {
        mb.style.setProperty("display", "block", "important");
        mb.style.setProperty("min-height", "200px", "important");
        mb.style.setProperty("flex", "1 1 auto", "important");
        mb.style.setProperty("overflow", "auto", "important");
      }
      var tp = ws.closest(".wm-tabpanel");
      if (tp) {
        tp.style.setProperty("display", "block", "important");
        tp.setAttribute("data-active", "1");
      }
    } catch (eMb) {}
    var syn = buildSyntheticWmLeatherOptionsFromSelect(leatherSel);
    if (!syn.length) {
      console.warn("[MTL leather modal] no leather options on native <select>");
      return 0;
    }

    var wm = Array.isArray(window.__WM_LEATHER_OPTIONS__) ? window.__WM_LEATHER_OPTIONS__ : [];
    var tabPanel = ws.closest ? ws.closest(".wm-tabpanel") : null;
    var beforeTiles = ws.querySelectorAll(".wm-tile").length;
    var beforeGrades = ws.querySelectorAll(".wm-grade-row").length;

    var existingGrid = ws.querySelector(".mtl-leather-modal-grid");
    var existingN = existingGrid ? existingGrid.querySelectorAll(".mtl-leather-modal-card").length : 0;
    if (existingGrid && existingN === syn.length) {
      /* Cards already correct — touching the DOM would re-trigger the MutationObserver and cause an infinite loop. */
      return syn.length;
    }

    console.log("[MTL leather modal] injecting", syn.length, "cards into #wmSections", {
      parentTab: tabPanel && tabPanel.id ? "#" + tabPanel.id : "(none)",
      childrenBefore: ws.children.length,
      wmTilesBefore: beforeTiles,
      wmGradeRowsBefore: beforeGrades,
      nativeLeatherOptions: syn.length,
    });

    ws.innerHTML = "";

    var grid = document.createElement("div");
    grid.className = "mtl-leather-modal-grid";

    syn.forEach(function (s) {
      var wrow = wmRowForNativeValue(wm, s.value);
      var nameLine = (wrow && ((wrow.family || "") + " " + (wrow.color || "")).trim()) || s.family || s.label;
      nameLine = String(nameLine).replace(/\s+/g, " ").trim();
      var gradeRaw = (wrow && wrow.grade != null && String(wrow.grade)) || s.grade || "—";
      var gradeLine = String(gradeRaw).replace(/\s+/g, " ").trim();
      if (gradeLine && gradeLine !== "—" && !/^grade\b/i.test(gradeLine)) {
        gradeLine = /^base$/i.test(gradeLine) ? "Grade 1000" : "Grade " + gradeLine;
      }

      var mergedSw = (wrow && wrow.swatches) || s.swatches || [];
      var imgUrl = pickFirstSwatchUrl({ swatches: mergedSw });

      var card = document.createElement("button");
      card.type = "button";
      card.className = "mtl-leather-modal-card";
      card.setAttribute("data-leather-value", String(s.value));

      var thumb = document.createElement("div");
      thumb.className = "mtl-leather-modal-thumb";
      if (imgUrl) {
        var img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.src = imgUrl.indexOf("?") === -1 ? imgUrl + "?v=" + IMG_V : imgUrl + "&v=" + IMG_V;
        thumb.appendChild(img);
      } else {
        thumb.classList.add("mtl-leather-modal-thumb--empty");
        thumb.textContent = "Swatch";
      }

      var meta = document.createElement("div");
      meta.className = "mtl-leather-modal-meta";
      var nameEl = document.createElement("div");
      nameEl.className = "mtl-leather-modal-name";
      nameEl.textContent = nameLine || "Leather";
      var gradeEl = document.createElement("div");
      gradeEl.className = "mtl-leather-modal-grade";
      gradeEl.textContent = gradeLine;

      meta.appendChild(nameEl);
      meta.appendChild(gradeEl);
      card.appendChild(thumb);
      card.appendChild(meta);

      card.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var sel = findNativeLeatherSelectEl() || leatherSel;
        if (!sel) return;
        sel.value = s.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof jQuery !== "undefined") jQuery(sel).trigger("change");
        var lab = String(s.label || nameLine || "").replace(/\s+/g, " ").trim();
        var wmSummary = document.getElementById("wmSummary");
        if (wmSummary) wmSummary.textContent = lab;
        var mcSum = document.getElementById("mcLeatherSummary");
        if (mcSum) mcSum.textContent = lab;
        var picked = document.getElementById("wmPicked");
        if (picked) picked.textContent = lab;
        var ov = document.querySelector(".wm-overlay");
        if (ov) ov.style.display = "none";
        if (typeof window.mcRenderLeatherPreviewStrip === "function") mtlInvokeRenderLeatherPreviewStrip(true);
        if (typeof window.mcSyncLeatherSummary === "function") window.mcSyncLeatherSummary();
      };

      grid.appendChild(card);
    });

    ws.appendChild(grid);
    var nCards = grid.querySelectorAll(".mtl-leather-modal-card").length;
    console.log("[MTL leather modal] injected .mtl-leather-modal-card count:", nCards, "(expect > 0 with leather options)");
    try {
      window.__MTL_LAST_LEATHER_MODAL_INJECT__ = { at: Date.now(), cards: nCards };
    } catch (eW) {}
    return nCards;
    } catch (eAll) {
      console.error("[MTL] FAILURE injectSectionalNativeLeatherModal (top-level)", eAll);
      if (eAll && eAll.stack) console.error(eAll.stack);
      return 0;
    }
  }

  function appendFallbackLeatherGridIfEmpty(leatherSel) {
    if (!leatherSel) return 0;
    var wmSections = document.getElementById("wmSections");
    if (!wmSections) return 0;
    var syn = buildSyntheticWmLeatherOptionsFromSelect(leatherSel);
    if (!syn.length) return 0;
    if (wmSections.querySelector(".wm-tile")) return 0;
    Array.prototype.forEach.call(wmSections.querySelectorAll(".mtl-fallback-leather-grid"), function (n) {
      n.remove();
    });
    var wrap = document.createElement("div");
    wrap.className = "mtl-fallback-leather-grid";
    wrap.style.cssText = "margin:8px 0;padding:8px;border:1px dashed #888;background:#fafafa;";
    var grid = document.createElement("div");
    grid.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;max-height:55vh;overflow:auto;";
    syn.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mtl-fallback-leather-btn";
      b.style.cssText =
        "padding:10px 12px;border:1px solid #333;background:#fff;cursor:pointer;text-align:left;font-size:13px;";
      b.textContent = o.label;
      b.onclick = function (ev) {
        ev.preventDefault();
        var sel = findNativeLeatherSelectEl() || leatherSel;
        if (!sel) return;
        sel.value = o.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        if (typeof jQuery !== "undefined") jQuery(sel).trigger("change");
        var ov = document.querySelector(".wm-overlay");
        if (ov) ov.style.display = "none";
      };
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    wmSections.appendChild(wrap);
    return syn.length;
  }

  function fillLeatherModalFromNativeSelect(leatherSel) {
    if (isSectionalProductPageClient()) {
      if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
      return 0;
    }
    var sel = leatherSel || findNativeLeatherSelectEl();
    if (!sel) return 0;
    if (!isWmOverlayVisible()) return 0;
    return appendFallbackLeatherGridIfEmpty(sel);
  }

  /* ── MTL Own Leather Picker ─────────────────────────────────────────────
   * Matches the theater seating leather picker exactly:
   *   • Swatches tab with grade rows + zoom (+) buttons
   *   • Leather Information tab with family descriptions/flags
   *   • Preview overlay, footer with Apply/Cancel
   *   • Cascade swatch URL loading (same as mini-swatches)
   * ──────────────────────────────────────────────────────────────────────── */

  function buildSwatchUrls(family, color) {
    var f = String(family || "").trim();
    var c = String(color  || "").trim();
    if (!f) return [];
    function slug(x){ return String(x||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""); }
    var names = [];
    if (f && c) {
      /* Confirmed working format: Family-Color.jpg (hyphen, title case) — try first */
      names.push(f + "-" + c);                                /* Traverse-Oak          */
      names.push(f + "-" + c.replace(/\s+/g,"-"));           /* Rein-Egg-Shell        */
      names.push(f.toLowerCase() + "-" + c.toLowerCase());   /* traverse-oak          */
      names.push(f.toLowerCase() + "-" + c.toLowerCase().replace(/\s+/g,"-")); /* rein-egg-shell */
      /* Fallbacks */
      names.push(f + " " + c);                               /* Traverse Oak          */
      names.push(f.toLowerCase() + " " + c.toLowerCase());   /* traverse oak          */
      names.push(f + "_" + c);                               /* Traverse_Oak          */
      names.push(f + "_" + c.replace(/\s+/g,"_"));           /* Rein_Egg_Shell        */
      names.push(slug(f) + "-" + slug(c));
      names.push(slug(f) + "_" + slug(c));
      /* Color spelling variants */
      var cvars = [];
      if (/\bgrey\b/i.test(c)) cvars.push(c.replace(/\bgrey\b/gi,"gray"));
      if (/\bgray\b/i.test(c)) cvars.push(c.replace(/\bgray\b/gi,"grey"));
      if (/\begg\s+shell\b/i.test(c)) cvars.push(c.replace(/\begg\s+shell\b/gi,"eggshell"));
      cvars.forEach(function(cv){
        names.push(f + "-" + cv);
        names.push(f + " " + cv);
      });
    } else {
      names.push(f);
      names.push(f.toLowerCase());
      names.push(slug(f));
    }
    var out = []; var seen = {};
    var exts = [".jpg",".jpeg",".png",".webp",".gif"]; /* .jpg first — confirmed working ext */
    ["/v/vspfiles/swatches/","/vspfiles/swatches/"].forEach(function(base){
      names.forEach(function(n){
        exts.forEach(function(ext){
          var url = base + encodeURIComponent(n + ext);
          if (!seen[url]){ seen[url]=true; out.push(url); }
        });
      });
    });
    return out;
  }

  function mtlRemoveLeatherPickerHint() {
    var hint = document.getElementById("mtl-own-picker-hint");
    if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
  }

  function mtlGatherLeatherPickerRows() {
    mtlRemoveLeatherPickerHint();
    mtlSyncSectionalLeatherFromDom();
    if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();

    var leatherSel = findNativeLeatherSelectEl();
    if (!leatherSel) {
      var collectPk = mtlGetNativeLeatherCollectFn();
      var canonPk = collectPk ? collectPk() : null;
      if (canonPk && canonPk.length) leatherSel = canonPk[0];
    }
    if (!leatherSel) {
      var configSel = null;
      try {
        configSel = findConfigurationSelect();
      } catch (eCfg) {}
      var scan = document.querySelectorAll(
        "#options_table select, #v65-product-parent select, #content_area select, form[action*='ProductDetails'] select, form[action*='productdetails'] select"
      );
      var si;
      var best = null;
      var bestN = 0;
      /** Never “max option count wins” across arbitrary PDP selects — mirror findNative fallback row keywords only. */
      var rowHintRx =
        /(choose cover|choose leather|select leather|select a leather|select\s+a\s+leather|upholstery|cover|fabric|grade|swatch|palliser|material|color\s*choice)/i;
      for (si = 0; si < scan.length; si++) {
        var s = scan[si];
        if (!s || !s.options) continue;
        if (configSel && s === configSel) continue;
        if (isVolusionConfigurationRowSelect(s)) continue;
        var idn = String(s.id || "") + " " + String(s.name || "");
        if (/qty|quantity/i.test(idn)) continue;
        var ctxLc = getVolusionOptionRowContextLower(s);
        if (!rowHintRx.test(ctxLc)) continue;
        var syn = buildSyntheticWmLeatherOptionsFromSelect(s);
        if (syn.length > bestN) {
          bestN = syn.length;
          best = s;
        }
      }
      if (best && bestN > 0) leatherSel = best;
    }
    if (leatherSel) ensureLeatherOptionsFromNativeSelect(leatherSel);

    var wm = Array.isArray(window.__WM_LEATHER_OPTIONS__) ? window.__WM_LEATHER_OPTIONS__ : [];
    var all = [];
    if (wm.length) {
      wm.forEach(function (r) {
        if (!r) return;
        var family = r.family || "";
        var color = r.color || "";
        var nameLine = (family + (color ? " " + color : "")).trim() || r.label || "";
        all.push({
          family: family,
          color: color,
          grade: r.grade != null ? String(r.grade) : "Base",
          value: r.value,
          label: r.label || nameLine,
          nameLine: nameLine.replace(/\s+/g, " ").trim(),
          swatches: Array.isArray(r.swatches) ? r.swatches.slice() : [],
        });
      });
    }
    if (!all.length && leatherSel) {
      buildSyntheticWmLeatherOptionsFromSelect(leatherSel).forEach(function (s) {
        var raw = String(s.family || s.label || "")
          .replace(/\s+/g, " ")
          .trim();
        var parts = raw.split(" ").filter(Boolean);
        var family = parts.shift() || "";
        var color = parts.join(" ").trim();
        var nameLine = (family + (color ? " " + color : "")).trim();
        all.push({
          family: family,
          color: color,
          grade: s.grade || "Base",
          value: s.value,
          label: s.label,
          nameLine: nameLine,
          swatches: buildSwatchUrls(family, color),
        });
      });
    }
    return { all: all, leatherSel: leatherSel };
  }

  function mtlOpenOwnLeatherPicker() {
    if (!isSectionalProductPageClient()) return;
    ensureSectionalLeatherStripDom();
    var gathered = mtlGatherLeatherPickerRows();
    var all = gathered.all;
    var leatherSel = gathered.leatherSel;

    var old = document.getElementById("mtl-own-picker");
    if (old) old.parentNode.removeChild(old);
    var oldPrev = document.getElementById("mtl-own-preview");
    if (oldPrev) oldPrev.parentNode.removeChild(oldPrev);

    var LEATHER_INFO = window.__MTL_LEATHER_INFO__ || {};
    var GRADE_UP = window.__MTL_GRADE_UPCHARGE__ || { "2000": 99, "3000": 149 };

    function gradeLabel(g){
      if (!g || /^base$/i.test(g)) return "Grade 1000";
      var amt = GRADE_UP[String(g)];
      return amt ? "Grade " + g + " (+$" + amt + "/seat)" : "Grade " + g;
    }
    function escHtml(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

    if (!all.length) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[MTL picker] no leather options yet — skipping open");
      }
      return;
    }
    console.log("[MTL picker] total leathers:", all.length);

    /* Group by grade, sorted */
    var grades = []; var byGrade = {};
    all.forEach(function(o){
      var g = o.grade || "Base";
      if (!byGrade[g]){ grades.push(g); byGrade[g] = []; }
      byGrade[g].push(o);
    });
    grades.sort(function(a,b){
      function gk(g){ if (!g||/^base$/i.test(g)) return 0; var n=parseInt(g,10); return isNaN(n)?9999:n; }
      return gk(a)-gk(b);
    });

    /* State */
    var picked = null; var pickedTile = null;
    var curVal = leatherSel ? leatherSel.value : "";
    if (curVal) {
      for (var ai=0; ai<all.length; ai++){ if (String(all[ai].value)===String(curVal)){ picked=all[ai]; break; } }
    }

    /* ── DOM ── */

    /* Backdrop */
    var backdrop = document.createElement("div");
    backdrop.id = "mtl-own-picker";
    backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:2147483647;padding:18px;box-sizing:border-box";
    backdrop.setAttribute("data-mtl-generated", "true");
    backdrop.setAttribute("data-mtl-sectional-generated", "true");
    backdrop.onclick = function(ev){ if (ev.target===backdrop) closePicker(); };

    /* Modal (reuse .wm-modal CSS from template) */
    var modal = document.createElement("div");
    modal.className = "wm-modal";

    /* Header */
    var modalHdr = document.createElement("div"); modalHdr.className = "wm-modal-header";
    var titleWrap = document.createElement("div");
    var titleEl = document.createElement("div"); titleEl.className = "wm-modal-title"; titleEl.textContent = "Select Your Leather";
    var subEl   = document.createElement("div"); subEl.className   = "wm-modal-sub";   subEl.textContent   = "One leather applies to all seats";
    titleWrap.appendChild(titleEl); titleWrap.appendChild(subEl);
    var closeBtn = document.createElement("button");
    closeBtn.type="button"; closeBtn.className="wm-close"; closeBtn.innerHTML="&times;"; closeBtn.setAttribute("aria-label","Close");
    closeBtn.onclick = function(){ closePicker(); };
    modalHdr.appendChild(titleWrap); modalHdr.appendChild(closeBtn);

    /* Tabs */
    var tabsEl = document.createElement("div"); tabsEl.className = "wm-tabs";
    var tabSwBtn = document.createElement("button"); tabSwBtn.type="button"; tabSwBtn.className="wm-tab"; tabSwBtn.textContent="Swatches"; tabSwBtn.dataset.active="1";
    var tabInBtn = document.createElement("button"); tabInBtn.type="button"; tabInBtn.className="wm-tab"; tabInBtn.textContent="Leather Information"; tabInBtn.dataset.active="0";
    tabsEl.appendChild(tabSwBtn); tabsEl.appendChild(tabInBtn);

    /* Body */
    var bodyEl = document.createElement("div"); bodyEl.className = "wm-modal-body";
    var panelSw = document.createElement("div"); panelSw.className="wm-tabpanel"; panelSw.dataset.active="1";
    var panelIn = document.createElement("div"); panelIn.className="wm-tabpanel"; panelIn.dataset.active="0";
    var infoGradeHdr = document.createElement("div"); infoGradeHdr.className="wm-infoGradeHeader";
    var infoList     = document.createElement("div"); infoList.className="wm-info-list";
    panelIn.appendChild(infoGradeHdr); panelIn.appendChild(infoList);
    bodyEl.appendChild(panelSw); bodyEl.appendChild(panelIn);

    /* Footer */
    var footEl = document.createElement("div"); footEl.className = "wm-modal-footer";
    var pickedLabel = document.createElement("div");
    pickedLabel.textContent = picked ? (picked.nameLine || picked.label || "No selection") : "No selection";
    var footRight = document.createElement("div");
    var cancelSpan = document.createElement("span"); cancelSpan.className="wm-cancel"; cancelSpan.textContent="Cancel";
    cancelSpan.onclick = function(){ closePicker(); };
    var applyBtn = document.createElement("button"); applyBtn.type="button"; applyBtn.className="wm-apply"; applyBtn.textContent="Apply";
    applyBtn.onclick = function(){ applyPicked(); };
    footRight.appendChild(cancelSpan); footRight.appendChild(applyBtn);
    footEl.appendChild(pickedLabel); footEl.appendChild(footRight);

    /* Preview overlay */
    var previewEl = document.createElement("div");
    previewEl.id = "mtl-own-preview";
    previewEl.setAttribute("data-mtl-generated", "true");
    previewEl.setAttribute("data-mtl-sectional-generated", "true");
    previewEl.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:2147483647;padding:18px;box-sizing:border-box";
    previewEl.innerHTML =
      '<div style="width:min(720px,92vw);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600">' +
          '<span id="mtl-preview-title">Leather preview</span>' +
          '<button type="button" id="mtl-preview-close" style="border:0;background:none;font-size:22px;cursor:pointer;line-height:1">&times;</button>' +
        '</div>' +
        '<div style="padding:14px"><img id="mtl-preview-img" style="width:100%;height:auto;display:block;border-radius:12px;border:1px solid #eee" alt="Swatch preview"/></div>' +
      '</div>';
    previewEl.onclick = function(ev){ if (ev.target===previewEl) previewEl.style.display="none"; };
    var prevImg=null, prevTitle=null;
    function openPreview(name, src){
      if (!src) return;
      if (!prevImg){ prevImg=previewEl.querySelector("#mtl-preview-img"); prevTitle=previewEl.querySelector("#mtl-preview-title"); previewEl.querySelector("#mtl-preview-close").onclick=function(){ previewEl.style.display="none"; }; }
      prevTitle.textContent = name||"Leather preview";
      prevImg.src = src;
      previewEl.style.display = "flex";
    }

    /* Tab switching */
    var lastInfoGrade = null;
    function setTab(which){
      var sw = (which==="swatches");
      tabSwBtn.dataset.active = sw?"1":"0"; tabInBtn.dataset.active = sw?"0":"1";
      panelSw.dataset.active  = sw?"1":"0"; panelIn.dataset.active  = sw?"0":"1";
      if (!sw) renderGradeInfo(lastInfoGrade||(grades[0]||"Base"));
    }
    tabSwBtn.onclick = function(e){ e.preventDefault(); setTab("swatches"); };
    tabInBtn.onclick = function(e){ e.preventDefault(); setTab("info"); };

    /* Leather Information renderer */
    function renderGradeInfo(g){
      lastInfoGrade = g;
      var famNames=[]; var seen={};
      (byGrade[g]||[]).forEach(function(o){ if (o.family && !seen[o.family]){ seen[o.family]=true; famNames.push(o.family); } });
      famNames.sort(function(a,b){ return a.localeCompare(b,undefined,{sensitivity:"base"}); });
      infoGradeHdr.textContent = gradeLabel(g) + "   Leather Information";
      infoList.innerHTML = "";
      if (!famNames.length){ infoList.innerHTML='<div class="wm-info-card">No info available for this grade.</div>'; return; }
      famNames.forEach(function(fam){
        var info = LEATHER_INFO[fam];
        var card = document.createElement("div"); card.className="wm-info-card";
        if (!info){ card.innerHTML="<h4>"+escHtml(fam)+"</h4><div class='wm-info-desc'>Details coming soon.</div>"; infoList.appendChild(card); return; }
        card.innerHTML =
          "<h4>"+escHtml(fam)+"</h4>"+
          "<div class='wm-info-desc'>"+escHtml(info.description||"")+"</div>"+
          "<div class='wm-info-meta'>"+
            "<div><b>Available With Match</b><br>"+escHtml(info.match||"")+"</div><br>"+
            "<div><b>Thickness</b><br>"+escHtml(info.thickness||"")+"</div><br>"+
            "<div><b>Finish Type</b><br>"+escHtml(info.finishType||"")+"</div><br>"+
            "<div><b>Corrected</b><br>"+escHtml(info.corrected||"")+"</div><br>"+
            "<div><b>Country of Origin</b><br>"+escHtml(info.origin||"")+"</div>"+
          "</div>"+
          (info.flags||[]).map(function(fl){ return "<div class='wm-info-flag'><b>"+escHtml(fl.k)+"</b><div class='d'>"+escHtml(fl.v)+"</div></div>"; }).join("");
        infoList.appendChild(card);
      });
    }

    /* Tile builder */
    function buildTile(o){
      var tile = document.createElement("button");
      tile.type="button"; tile.className="wm-tile";
      tile.dataset.selected = (picked && picked.value===o.value) ? "1":"0";

      /* Use padding-bottom:100% intrinsic-ratio trick — reliable across all browsers,
         no dependency on aspect-ratio or height:100% resolving from a non-explicit parent height */
      /* Square wrapper using padding-bottom intrinsic ratio (rock-solid, no aspect-ratio dep) */
      var sw = document.createElement("div");
      sw.style.cssText = "position:relative;width:100%;padding-bottom:100%;border-radius:10px;border:1px solid #eee;background:#fafafa;overflow:hidden;margin-bottom:6px";
      var img = document.createElement("img"); img.alt=""; img.loading="eager";
      img.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none";
      /* Cascade through swatch URLs — store the one that successfully loaded on the img element itself */
      (function(imgEl, urls){
        var idx=0;
        function tryNext(){
          if (idx>=urls.length){ imgEl.removeAttribute("src"); return; }
          var url=urls[idx++];
          imgEl.onerror=function(){ if (imgEl.naturalWidth===0) tryNext(); };
          imgEl.onload =function(){ imgEl.setAttribute("data-loaded-src", imgEl.src); };
          imgEl.src=url;
        }
        tryNext();
      })(img, (o.family ? buildSwatchUrls(o.family, o.color) : o.swatches));
      sw.appendChild(img);

      var zoom = document.createElement("button");
      zoom.type="button"; zoom.className="wm-zoom"; zoom.textContent="+"; zoom.title="View larger";
      /* Make sure the zoom button is on top and clickable, regardless of any nested-button quirks */
      zoom.style.cssText = "position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:999px;border:1px solid #ddd;background:rgba(255,255,255,.92);cursor:pointer;font-size:16px;line-height:26px;text-align:center;z-index:5;padding:0";

      var nameEl = document.createElement("div"); nameEl.className="wm-name";
      nameEl.textContent = o.nameLine || "(Unnamed)";

      /* Use <div> wrapper instead of nested <button> to avoid invalid HTML (button inside button)
         which breaks click handling on nested zoom button in some browsers */
      tile.appendChild(sw); tile.appendChild(zoom); tile.appendChild(nameEl);

      tile.onclick = function(e){
        /* If the click came from the zoom button, don't treat as tile selection */
        if (e.target === zoom || (e.target && e.target.closest && e.target.closest(".wm-zoom"))) return;
        e.preventDefault();
        if (pickedTile) pickedTile.dataset.selected="0";
        tile.dataset.selected="1"; pickedTile=tile; picked=o;
        pickedLabel.textContent = o.nameLine||o.label||"";
      };
      /* Use mousedown so we fire before the parent button's click handler picks the tile,
         and grab src from the image's data attribute set by onload */
      zoom.addEventListener("mousedown", function(e){
        e.preventDefault(); e.stopPropagation();
      });
      zoom.addEventListener("click", function(e){
        e.preventDefault(); e.stopPropagation();
        var src = img.getAttribute("data-loaded-src") || img.currentSrc || img.getAttribute("src") || (o.swatches && o.swatches[0]) || "";
        console.log("[MTL picker] zoom clicked, src:", src);
        if (src) openPreview(o.nameLine, src);
      }, true);

      if (tile.dataset.selected==="1") pickedTile=tile;
      return tile;
    }

    /* Build swatch tab content */
    var frag = document.createDocumentFragment();
    grades.forEach(function(g){
      var row = document.createElement("div"); row.className="wm-grade-row";
      var titleDiv = document.createElement("div"); titleDiv.className="wm-grade-title"; titleDiv.textContent=gradeLabel(g);
      var infoBtn  = document.createElement("button"); infoBtn.type="button"; infoBtn.className="wm-grade-infoBtn"; infoBtn.textContent="Leather Information";
      infoBtn.onclick = function(e){ e.preventDefault(); e.stopPropagation(); lastInfoGrade=g; setTab("info"); };
      row.appendChild(titleDiv); row.appendChild(infoBtn); frag.appendChild(row);

      var grid = document.createElement("div"); grid.className="wm-grid";
      var list = (byGrade[g]||[]).slice().sort(function(a,b){
        var af=(a.family||"").localeCompare(b.family||"",undefined,{sensitivity:"base"});
        return af||(a.color||"").localeCompare(b.color||"",undefined,{sensitivity:"base"});
      });
      list.forEach(function(o){ grid.appendChild(buildTile(o)); });
      frag.appendChild(grid);
    });
    panelSw.appendChild(frag);

    /* Apply / close */
    function applyPicked(){
      if (picked){
        if (leatherSel) {
          leatherSel.value = picked.value;
          leatherSel.dispatchEvent(new Event("change",{bubbles:true}));
          leatherSel.dispatchEvent(new Event("input",{bubbles:true}));
          if (typeof jQuery!=="undefined") jQuery(leatherSel).trigger("change");
        }
        var lab = String(picked.nameLine||picked.label||"").replace(/\s+/g," ").trim();
        ["wmSummary","mcLeatherSummary","wmPicked"].forEach(function(id){ var el=document.getElementById(id); if(el) el.textContent=lab; });
        if (typeof window.mcRenderLeatherPreviewStrip==="function") mtlInvokeRenderLeatherPreviewStrip(true);
        if (typeof window.mcSyncLeatherSummary==="function") window.mcSyncLeatherSummary();
      }
      closePicker();
    }
    function closePicker(){
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (previewEl.parentNode) previewEl.parentNode.removeChild(previewEl);
      var wmOv=document.querySelector(".wm-overlay"); if (wmOv) wmOv.style.display="none";
    }

    /* Assemble */
    modal.appendChild(modalHdr); modal.appendChild(tabsEl); modal.appendChild(bodyEl); modal.appendChild(footEl);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.body.appendChild(previewEl);

    console.log("[MTL own picker] opened with", all.length, "leathers,", grades.length, "grade(s)");
  }
  window.mtlOpenOwnLeatherPicker = mtlOpenOwnLeatherPicker;
  window.mtlRemoveLeatherPickerHint = mtlRemoveLeatherPickerHint;

  function bindViewAllLeathersButtons() {
    if (!isSectionalProductPageClient()) return;
    if (window.MTL_LEATHER_LOCK.handlersBound) return;
    window.MTL_LEATHER_LOCK.handlersBound = true;
    document.addEventListener(
      "click",
      function (ev) {
        var btn = ev.target && ev.target.closest && ev.target.closest("#mc-acc-row-leather .mc-acc-config-btn");
        if (!btn) return;
        if (ev.preventDefault) ev.preventDefault();
        if (ev.stopPropagation) ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        if (typeof window.mcOpenWmLeatherModal === "function") {
          window.mcOpenWmLeatherModal(ev);
        } else if (typeof window.mcOpenWmLeatherOverlay === "function") {
          window.mcOpenWmLeatherOverlay(ev);
        }
      },
      true
    );
  }

  function patchLeatherModalFallback() {
    /* Intentionally empty — sectionals use template mcOpenWmLeatherModal / initIfReady (same as theater). */
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
      ? wmSections.querySelectorAll(".mtl-leather-modal-card, .wm-tile, .mtl-fallback-leather-btn").length
      : 0;

    var miniStrip = document.getElementById("mcLeatherSwatchStrip");
    var miniCount = miniStrip ? miniStrip.querySelectorAll(".mc-leather-mini-swatch, .mc-mini-swatch").length : 0;

    var sec = document.getElementById("mtl-sectional-configurations");
    var planner = document.getElementById("mcPlannerRow");
    var summaryBeforePopular =
      !!(sec && planner && sec.parentNode === planner.parentNode && sec.previousElementSibling === planner);

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
      productSummaryRowBeforePopularConfigurations: summaryBeforePopular,
      mergedRecordsFull: mergedPreview,
      context: ctx,
    };
  }

  /** Opt-in (?mtlSectionalDebug=1): console only — no on-screen panel. */
  function runMtlSectionalDiagnosticConsoleOnly(label) {
    if (!SECTIONAL_DBG) return;
    try {
      var snap = collectMtlDebugSnapshot({ when: label || "" });
      console.log("[MTL DEBUG]", label || "", snap);
    } catch (eDiag) {
      console.error("[MTL DEBUG collect failed]", eDiag);
    }
  }

  function removeMtlDebugPanelIfPresent() {
    try {
      var el = document.getElementById("mtl-debug-panel");
      if (el) el.remove();
    } catch (eRm) {}
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

  /** Parses +$N / + N style upcharges from Volusion option text (configuration row). */
  function parseUpchargeFromOptionText(text) {
    var s = String(text || "");
    var m = s.match(/\+\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
    if (m) return Number(String(m[1]).replace(/,/g, ""));
    m = s.match(/\(\s*(?:\+|plus)\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
    if (m) return Number(String(m[1]).replace(/,/g, ""));
    return 0;
  }

  function effectiveConfigurationUpcharge(entry) {
    if (!entry) return 0;
    var pd = entry.priceDiff;
    if (pd != null && pd !== "" && isFinite(Number(pd))) return Number(pd);
    if (entry.upcharge != null && isFinite(Number(entry.upcharge))) return Number(entry.upcharge);
    return parseUpchargeFromOptionText(entry.rawOptionText || entry.label || "");
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

  /** Display model/configuration id like Volusion catalog (e.g. 07-15 → 07/15). */
  function formatDiagramConfigCode(code) {
    var s = String(code || "").trim();
    if (!s) return "";
    return s.replace(/-/g, "/");
  }

  function findConfigurationSelect() {
    var root =
      document.querySelector("#v65-product-parent #options_table, #v65-product-parent table[id*='options_table']") ||
      document.querySelector("#options_table, table[id*='options_table']") ||
      document.querySelector("#content_area table[id*='options_table']");
    var selects = root
      ? Array.from(root.querySelectorAll("select"))
      : Array.from(
          document.querySelectorAll(
            "#v65-product-parent select, #options_table select, #content_area table[id*='options_table'] select"
          )
        );

    var found = selects.find(function (sel) {
      if (sel.classList && sel.classList.contains("mc-native-leather")) return false;
      if (sel.closest && sel.closest(".mc-native-leather")) return false;
      return isVolusionConfigurationRowSelect(sel);
    });
    if (found) return found;

    var path = String(location.pathname || "").toLowerCase();
    var sectionalOrLikely =
      document.documentElement.classList.contains("is-sectional-product") ||
      (typeof window.isSectionalProductPage === "function" && window.isSectionalProductPage()) ||
      path.indexOf("-sc-") !== -1;
    if (!sectionalOrLikely) {
      try {
        var cfgEarly = window.MTL_SECTIONAL_CONFIGS;
        if (cfgEarly && typeof cfgEarly === "object") {
          var keysE = Object.keys(cfgEarly);
          var blobE = (
            path +
            " " +
            String(document.title || "").toLowerCase()
          ).toLowerCase();
          var pcE = document.querySelector('input[name="ProductCode"], input[name="productcode"]');
          var pcEv = pcE ? String(pcE.value || "").toLowerCase() : "";
          for (var ie = 0; ie < keysE.length; ie++) {
            var ke = String(keysE[ie] || "").toLowerCase();
            if (!ke) continue;
            if (blobE.indexOf(ke) !== -1 || (pcEv && pcEv.indexOf(ke) !== -1)) {
              sectionalOrLikely = true;
              break;
            }
          }
        }
      } catch (eLik) {}
    }
    if (!sectionalOrLikely) return null;

    var scored = [];
    var si;
    for (si = 0; si < selects.length; si++) {
      var cand = selects[si];
      if (cand.classList && cand.classList.contains("mc-native-leather")) continue;
      if (cand.closest && cand.closest(".mc-native-leather")) continue;
      var rt = "";
      var trC = cand.closest("tr");
      var tdC = cand.closest("td");
      var parC = cand.parentElement;
      if (trC) rt += " " + trC.innerText;
      if (tdC) rt += " " + tdC.innerText;
      if (parC) rt += " " + parC.innerText;
      rt = rt.toLowerCase();
      if (
        /(choose\s+cover|choose\s+leather|select\s+leather|select\s+a\s+leather|upholstery|fabric\s*selection|fabric\s*cover)/i.test(
          rt
        )
      )
        continue;
      var realOpts = Array.from(cand.options || []).filter(function (o) {
        return !isPlaceholderConfigOption(o);
      });
      if (realOpts.length < 2) continue;
      var joined = realOpts
        .map(function (o) {
          return String(o.textContent || "");
        })
        .join(" ");
      if (!/\d/.test(joined)) continue;
      var sc = realOpts.length;
      if (/\d\s*[-–\/x]\s*\d/.test(joined)) sc += 10;
      scored.push({ sel: cand, score: sc });
    }
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    return scored.length ? scored[0].sel : null;
  }

  /** Sectional PDP: remove chrome from a prior injection pass (safe to omit price UI; template uses only data-mtl-generated there). */
  function mtlRemoveSectionalGeneratedChrome() {
    document.querySelectorAll('[data-mtl-sectional-generated="true"]').forEach(function (el) {
      try {
        el.remove();
      } catch (eRm) {}
    });
  }

  /** Hide Volusion duplicate #priceWithOptions / .option_pricing after custom retail/member block exists and cards mounted. */
  function mtlHideLegacyVolusionPriceDuplicatesForSectional() {
    if (!document.documentElement.classList.contains("is-sectional-product")) return;
    if (!window.__mtlReplacementRenderSucceeded) return;
    if (!document.querySelector(".mtl-product-price-block")) return;
    document
      .querySelectorAll(
        "#v65-product-parent .option_pricing, #content_area .option_pricing," +
          "#v65-product-parent #priceWithOptions, #content_area #priceWithOptions," +
          "#v65-product-parent #priceWithOptionsNoTax, #content_area #priceWithOptionsNoTax"
      )
      .forEach(function (n) {
        if (!n || (n.closest && n.closest(".mtl-product-price-block"))) return;
        try {
          n.style.setProperty("display", "none", "important");
          n.style.setProperty("visibility", "hidden", "important");
        } catch (eH) {}
      });
  }

  function hideConfigurationRow() {
    if (!window.__mtlReplacementRenderSucceeded) {
      return;
    }
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
    mtlHideLegacyVolusionPriceDuplicatesForSectional();
    [500, 1500, 3000].forEach(function (ms) {
      setTimeout(function () {
        hideConfigurationRow();
        mtlHideLegacyVolusionPriceDuplicatesForSectional();
      }, ms);
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
    if (!isSectionalProductPageClient()) return;
    if (document.getElementById("mc-pdp-accordion") && section.closest && section.closest("#mc-pdp-accordion")) {
      return;
    }
    var parent = section.parentNode;
    var planner = document.getElementById("mcPlannerRow");
    var block = findLeatherBlock();
    try {
      if (planner && planner.parentNode) {
        parent.insertBefore(planner, section);
      }
      if (block && block.parentNode && block !== section) {
        var ref = planner && planner.parentNode === parent ? planner : section;
        parent.insertBefore(block, ref);
      }
      if (planner && planner.parentNode === parent) {
        window.__MTL_LAYOUT_SUMMARY_BEFORE_CONFIG__ = {
          ok: section.previousElementSibling === planner,
          sectionId: section.id,
          rowId: planner.id,
        };
        console.log(
          "[MTL layout] Product Summary (#mcPlannerRow) immediately before Popular Configurations:",
          window.__MTL_LAYOUT_SUMMARY_BEFORE_CONFIG__.ok
        );
      }
    } catch (eMv) {
      console.warn("Could not move sectional chrome above configurations:", eMv);
    }
  }

  function mountPopularConfigurationsInAccordion(section) {
    try {
      if (!section || !document.documentElement.classList.contains("is-sectional-product")) return;
      if (typeof window.mcEnsureSectionalPopularAccordionRow === "function") {
        window.mcEnsureSectionalPopularAccordionRow();
      }
      var acc = document.getElementById("mc-pdp-accordion");
      var row = document.getElementById("mc-acc-row-popularconfig");
      var host = row ? row.querySelector(".mc-acc-content--popular-host") : null;
      var nCards = section.querySelectorAll(".mtl-sectional-card").length;
      console.log(
        "[MTL] config renderer — accordion:",
        !!acc,
        "host:",
        !!host,
        "cards:",
        nCards
      );
      if (!acc || !row || !host) return;
      if (!host.contains(section)) {
        host.appendChild(section);
      }
      section.dataset.mtlAccordionPopular = "1";
      var hid = section.querySelector(".mtl-sectional-heading");
      if (hid) {
        hid.setAttribute("hidden", "");
        hid.style.display = "none";
      }
      section.style.marginTop = "0";
      section.style.marginBottom = "0";
      section.style.paddingTop = "0";
      section.style.display = "block";
      section.style.visibility = "visible";
      if (nCards > 0) {
        console.log("[MTL] config renderer mounted in accordion (" + nCards + " cards)");
      }
    } catch (eM) {
      console.warn("[MTL] mountPopularConfigurationsInAccordion", eM);
    }
  }

  window.MTL_retryMountPopularConfigurations = function () {
    var section = document.getElementById("mtl-sectional-configurations");
    var host = document.querySelector("#mc-acc-row-popularconfig .mc-acc-content--popular-host");
    console.log(
      "[MTL] config renderer retry — section:",
      !!section,
      "accordion host:",
      !!host,
      "cards:",
      section ? section.querySelectorAll(".mtl-sectional-card").length : 0
    );
    if (!section) {
      return;
    }
    mountPopularConfigurationsInAccordion(section);
  };

  /** Volusion may inject the cover <select> after configuration / smart-match scripts run. */
  window.MTL_promptVolusionCoverOptions = function () {
    if (!isSectionalProductPageClient()) return;
    try {
      if (typeof window.UpdateHiddenSmartMatchOptions === "function") {
        window.UpdateHiddenSmartMatchOptions("load");
      }
    } catch (eSm) {}
    var cs = findConfigurationSelect();
    if (!cs) return;
    try {
      var m = String(cs.name || "").match(/___(\d+)\s*$/);
      var catId = m ? m[1] : "2";
      if (typeof window.change_option === "function") {
        window.change_option(cs.name, cs.value);
      }
      if (typeof window.AutoUpdatePriceWithSelectedOptions === "function") {
        window.AutoUpdatePriceWithSelectedOptions(cs.value, catId);
      }
      cs.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (eCh) {}
    if (typeof window.mcTryInitWmLeather === "function") {
      window.mcTryInitWmLeather();
    }
    mtlRefreshSectionalLeatherUi();
  };

  function scheduleMoveLeatherAboveConfigurations(section) {
    if (!section) return;
    function tick() {
      moveLeatherAboveConfigurations(section);
    }
    tick();
    [500, 1500, 3000].forEach(function (ms) {
      setTimeout(tick, ms);
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

  function mtlWrapWmOpenForSectional() {
    /* Disabled — hijacking #wmOpen replaced theater modal tiles with empty sectional inject. */
    return;
    if (!isSectionalProductPageClient()) return;
    var btn = document.getElementById("wmOpen");
    if (!btn || btn.dataset.mtlModalWrapBound === "1") return;
    btn.dataset.mtlModalWrapBound = "1";
    var origOnclick = btn.onclick;
    btn.onclick = function (e) {
      if (typeof origOnclick === "function") {
        try { origOnclick.call(btn, e); } catch (eO) {}
      }
      /* Inject our leather cards right after the template's renderAllGradesTogether() ran.
         Use a micro-delay so any re-render from mcFireWmOpenProgrammatically retries is also covered. */
      function doInject() {
        var leatherSel = findNativeLeatherSelectEl();
        if (!leatherSel) return;
        var ws = document.getElementById("wmSections");
        if (!ws) return;
        var syn = buildSyntheticWmLeatherOptionsFromSelect(leatherSel);
        if (!syn.length) return;
        /* Always replace with our renderer cards — template's .wm-tile elements
           may be hidden by Volusion site CSS. injectSectionalNativeLeatherModal
           has its own skip guard (won't clear DOM if correct count already present). */
        console.log("[MTL modal-wrap] doInject: calling injectSectionalNativeLeatherModal");
        injectSectionalNativeLeatherModal(leatherSel);
      }
      /* Force display on modal body/tab panel in case Volusion CSS hides them,
         and inject cards. Run at several intervals to survive renderAllGradesTogether rewrites. */
      function doForceAndInject() {
        /* Force visibility of the modal body and tab panel */
        var wsNow = document.getElementById("wmSections");
        if (wsNow) {
          var mbNow = wsNow.closest(".wm-modal-body");
          if (mbNow) {
            mbNow.style.setProperty("display", "block", "important");
            mbNow.style.setProperty("min-height", "200px", "important");
            mbNow.style.setProperty("flex", "1 1 auto", "important");
            mbNow.style.setProperty("overflow", "auto", "important");
          }
          var tpNow = wsNow.closest(".wm-tabpanel");
          if (tpNow) {
            tpNow.style.setProperty("display", "block", "important");
            tpNow.setAttribute("data-active", "1");
          }
        }
        doInject();
      }
      [0, 80, 200, 420].forEach(function (ms) {
        window.setTimeout(doForceAndInject, ms);
      });
    };
    console.log("[MTL] wrapped #wmOpen.onclick for sectional modal injection");
  }

  function ensureMcWmOpenMountedListener() {
    if (document.documentElement.dataset.mtlWmOpenMountedListen === "1") return;
    document.documentElement.dataset.mtlWmOpenMountedListen = "1";
    document.addEventListener(
      "mcWmOpenMounted",
      function () {
        mtlRefreshSectionalLeatherUi();
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
    scheduleSectionalLeatherBootstrap();
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
    var m = pc.match(/^([A-Za-z][A-Za-z0-9]*)[-_]SC(?:[-_]|$)/i);
    if (!m) return "";
    return styleSegmentToPascal(m[1]) + "-SC";
  }

  function inferSectionalDiagramPngUrl(productKey, pcVal, configCode) {
    var prefix = getSectionalDiagramPrefix(productKey, pcVal);
    var cod = normalizeCode(configCode).replace(/\s+/g, "");
    if (!prefix || !cod) return "";
    return resolveSectionalDiagramAssetUrl(prefix + "-" + cod + ".png");
  }

  function mtlEscapeRegExp(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Resolve Palliser / sectional style for diagram + JSON rows.
   * 1) Volusion hidden ProductCode often looks like "{Style}-SC-…" (or _SC_).
   * 2) When the code is numeric-only, the product URL slug usually contains "{style}-sc-{digits}".
   * 3) Otherwise match known config keys on title / name / path (word boundaries only).
   */
  function resolveSectionalProductStyleKey(pcVal, allConfigs) {
    var cfg = allConfigs && typeof allConfigs === "object" ? allConfigs : {};
    var pc = String(pcVal || "").trim();
    var m = pc.match(/^([A-Za-z][A-Za-z0-9]*)[-_]SC(?:[-_]|$)/i);
    if (m && m[1]) {
      var fromCode = styleSegmentToPascal(m[1]);
      if (fromCode) {
        sectionalLog("sectional productKey from ProductCode", fromCode);
        return fromCode;
      }
    }
    var fromSlug = extractStyleFromSlugPath(String(location.pathname || ""), cfg);
    if (fromSlug) {
      sectionalLog("sectional productKey from URL slug", fromSlug);
      return fromSlug;
    }
    var keys = Object.keys(cfg).slice();
    keys.sort(function (a, b) {
      return b.length - a.length;
    });
    var nmEl =
      document.querySelector("#v65-product-parent [itemprop='name']") ||
      document.querySelector('[itemprop="name"]');
    var nameT = nmEl ? String(nmEl.textContent || "") : "";
    var h1el = document.querySelector("#v65-product-parent h1") || document.querySelector("h1");
    var h1t = h1el ? String(h1el.textContent || "") : "";
    var identityHay = (
      String(location.pathname || "") +
      " " +
      String(document.title || "") +
      " " +
      nameT +
      " " +
      h1t +
      " " +
      pc
    )
      .toLowerCase()
      .replace(/\s+/g, " ");
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      var key = keys[ki];
      var rx = new RegExp("\\b" + mtlEscapeRegExp(String(key).toLowerCase()) + "\\b", "i");
      if (rx.test(identityHay)) {
        sectionalLog("sectional productKey from identity text", key);
        return key;
      }
    }
    var pathTitlePc = (
      String(location.pathname || "") +
      " " +
      String(document.title || "") +
      " " +
      pc
    ).toLowerCase();
    if (/\baloira\b/i.test(pathTitlePc) && cfg.Alula) {
      sectionalLog("sectional productKey alias: Aloira → Alula (path/title/pc only)");
      return "Alula";
    }
    if (/\baloira\b/i.test(identityHay) && cfg.Alula) {
      sectionalLog("sectional productKey alias: Aloira → Alula (identity)");
      return "Alula";
    }
    return "";
  }

  /** e.g. /…/palliser-colebrook-sc-07-15-… → Colebrook when not inferrable from ProductCode. */
  function extractStyleFromSlugPath(pathname, cfg) {
    var p = String(pathname || "")
      .replace(/\\/g, "/")
      .replace(/_/g, "-")
      .toLowerCase();
    if (!p) return "";
    var keys = Object.keys(cfg || {}).slice();
    keys.sort(function (a, b) {
      return b.length - a.length;
    });
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var low = String(k).toLowerCase();
      var esc = mtlEscapeRegExp(low);
      if (new RegExp("[^a-z0-9]" + esc + "-sc-\\d+", "i").test(p)) return k;
      if (new RegExp("^" + esc + "-sc-\\d+", "i").test(p)) return k;
    }
    var GENERIC = {
      palliser: 1,
      sectionals: 1,
      sectional: 1,
      seating: 1,
      product: 1,
      store: 1,
      category: 1,
      products: 1,
      shop: 1,
      home: 1,
    };
    var re = /([a-z][a-z0-9]{2,})-sc-\d+/gi;
    var m;
    var candidates = [];
    while ((m = re.exec(p)) !== null) {
      var seg = m[1];
      if (GENERIC[seg]) continue;
      candidates.push(styleSegmentToPascal(seg));
    }
    if (!candidates.length) return "";
    for (i = candidates.length - 1; i >= 0; i--) {
      if (cfg[candidates[i]]) return candidates[i];
    }
    return candidates[candidates.length - 1];
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
      sum.setAttribute("data-mtl-generated", "true");
      sum.setAttribute("data-mtl-sectional-generated", "true");
      sum.innerHTML =
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Selected Configuration</span><span class="mtl-summary-value" id="mtl-sum-config">—</span></div>' +
        '<div class="mtl-summary-row"><span class="mtl-summary-label">Product Price</span><span class="mtl-summary-value" id="mtl-sum-price">—</span></div>' +
        '<p id="mtl-sectional-quote-hint" class="mtl-sectional-quote-hint"></p>';
      sum.dataset.mtlSummaryV3 = "1";
    } else {
      upgradeProductSummaryDom(sum);
    }
    try {
      sum.setAttribute("data-mtl-generated", "true");
      sum.setAttribute("data-mtl-sectional-generated", "true");
    } catch (eSumAttr) {}
    mountProductSummaryAboveAtc(sum);
    if (isSectionalProductPageClient()) {
      [80, 350, 900, 1800].forEach(function (ms) {
        window.setTimeout(function () {
          mountProductSummaryAboveAtc(sum);
        }, ms);
      });
    } else if (section && section.parentNode) {
      try {
        if (sum.parentNode !== section.parentNode) {
          section.parentNode.insertBefore(sum, section.nextSibling);
        }
      } catch (eIns) {
        console.error("[MTL] FAILURE product summary insertBefore", eIns);
      }
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
    var configLabel = cfg
      ? cfg.configurationTitle || cfg.label || cfg.code || code
      : code || "—";

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
    mountProductSummaryAboveAtc(sum);
  }

  function scheduleProductSummaryAfterConfigChange() {
    [250, 800, 1500].forEach(function (ms) {
      setTimeout(function () {
        if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
        mtlSyncSectionalLeatherFromDom();
        scheduleSectionalLeatherBootstrap();
        updateProductSummary();
        var sum = document.getElementById("mtl-product-summary");
        if (sum) mountProductSummaryAboveAtc(sum);
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

  function sectionalConfigStorageKey() {
    var pcInp = document.querySelector('input[name="ProductCode"], input[name="productcode"]');
    var pc = pcInp ? String(pcInp.value || "").trim() : "";
    return pc ? "mtl_sectional_config_" + pc : "";
  }

  function saveSectionalConfigToStorage(code, preferredNativeValue) {
    var key = sectionalConfigStorageKey();
    if (!key || !code) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          code: String(code),
          nativeValue: preferredNativeValue != null ? String(preferredNativeValue) : "",
          ts: Date.now(),
        })
      );
    } catch (eSave) {}
  }

  function restoreSectionalConfigFromStorage() {
    if (document.documentElement.dataset.mtlConfigRestored === "1") return false;
    var key = sectionalConfigStorageKey();
    if (!key) return false;
    var raw;
    try {
      raw = localStorage.getItem(key);
    } catch (eGet) {
      return false;
    }
    if (!raw) return false;
    var data;
    try {
      data = JSON.parse(raw);
    } catch (eParse) {
      return false;
    }
    if (!data || !data.code) return false;
    if (!document.querySelector("#mtl-sectional-configurations .mtl-sectional-card")) return false;
    var nv = data.nativeValue != null && String(data.nativeValue) !== "" ? data.nativeValue : null;
    selectConfigurationCard(data.code, nv);
    document.documentElement.dataset.mtlConfigRestored = "1";
    return true;
  }

  function scheduleSectionalConfigRestore() {
    if (!isSectionalProductPageClient()) return;
    [400, 1100, 2400, 4500].forEach(function (ms) {
      window.setTimeout(function () {
        restoreSectionalConfigFromStorage();
      }, ms);
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
    saveSectionalConfigToStorage(code, preferredNativeValue);
    selectNativeConfiguration(preferredNativeValue, code);
    scheduleProductSummaryAfterConfigChange();
    setTimeout(syncCardsSelectionHighlight, 50);
    [120, 400, 900, 1800].forEach(function (ms) {
      window.setTimeout(function () {
        var st = document.querySelector("#mcLeatherSwatchStrip");
        if (st && st.dataset.mtlSwatchesRendered === "true" && st.children.length > 0) return;
        mtlRefreshSectionalLeatherUi();
      }, ms);
    });
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

      var zoomBtn = card.querySelector(".mtl-sectional-diagram-zoom");
      if (zoomBtn && zoomBtn.dataset.mtlZoomBound !== "1") {
        zoomBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var im = card.querySelector("img.mtl-sectional-image");
          if (!im) return;
          var src = String(im.getAttribute("src") || im.src || "").trim();
          if (!src || src.indexOf("data:image/svg+xml") === 0) return;
          openSectionalDiagramLightbox(src, im.alt || "Configuration diagram");
        });
        zoomBtn.dataset.mtlZoomBound = "1";
      }

      card.dataset.mtlConfigBound = "1";
    });
  }

  function finalizeSectionalDiagramLightboxClosed() {
    var root = __mtlSectionalLbEl || document.getElementById("mtl-sectional-diagram-lightbox");
    if (!root || !root.classList.contains("is-open")) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    root.removeAttribute("data-mtl-lb-history");
    try {
      document.body.classList.remove("mtl-sectional-diagram-lightbox-open");
    } catch (eBody) {}
    var lbImg = root._mtlLbImg;
    if (lbImg) {
      lbImg.removeAttribute("src");
      lbImg.alt = "";
    }
  }

  function bindSectionalDiagramLightboxPopstateOnce() {
    if (__mtlSectionalLbPopstateBound) return;
    __mtlSectionalLbPopstateBound = true;
    window.addEventListener("popstate", function () {
      finalizeSectionalDiagramLightboxClosed();
    });
  }

  function requestCloseSectionalDiagramLightbox() {
    var root = __mtlSectionalLbEl || document.getElementById("mtl-sectional-diagram-lightbox");
    if (!root || !root.classList.contains("is-open")) return;
    if (root.getAttribute("data-mtl-lb-history") === "1") {
      try {
        history.back();
      } catch (eH) {
        finalizeSectionalDiagramLightboxClosed();
      }
    } else {
      finalizeSectionalDiagramLightboxClosed();
    }
  }

  function ensureSectionalDiagramLightbox() {
    if (__mtlSectionalLbEl) return __mtlSectionalLbEl;
    var root = document.createElement("div");
    root.id = "mtl-sectional-diagram-lightbox";
    root.className = "mtl-sectional-diagram-lightbox";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-hidden", "true");

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mtl-sectional-diagram-lightbox__close";
    closeBtn.setAttribute("aria-label", "Close enlarged diagram");
    closeBtn.innerHTML =
      '<span aria-hidden="true">\u00d7</span><span class="mtl-sectional-diagram-lightbox__vh">Close</span>';

    var panel = document.createElement("div");
    panel.className = "mtl-sectional-diagram-lightbox__panel";

    var lbImg = document.createElement("img");
    lbImg.className = "mtl-sectional-diagram-lightbox__img";
    lbImg.alt = "";
    try {
      lbImg.draggable = false;
    } catch (eLbDrag) {}

    panel.appendChild(lbImg);
    root.appendChild(closeBtn);
    root.appendChild(panel);

    root.addEventListener("click", function (e) {
      if (e.target === root) requestCloseSectionalDiagramLightbox();
    });
    panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    closeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      requestCloseSectionalDiagramLightbox();
    });

    root._mtlCloseDiagramLb = requestCloseSectionalDiagramLightbox;
    root._mtlLbImg = lbImg;

    try {
      document.body.appendChild(root);
    } catch (eAppend) {}

    __mtlSectionalLbEl = root;
    return root;
  }

  function bindSectionalDiagramLightboxEscapeOnce() {
    if (__mtlSectionalLbEscBound) return;
    __mtlSectionalLbEscBound = true;
    document.addEventListener(
      "keydown",
      function (e) {
        var root = document.getElementById("mtl-sectional-diagram-lightbox");
        if (!root || !root.classList.contains("is-open")) return;
        if (e.key === "Escape") {
          if (root._mtlCloseDiagramLb) root._mtlCloseDiagramLb();
        }
      },
      true
    );
  }

  function openSectionalDiagramLightbox(fullSrc, altText) {
    if (!fullSrc || String(fullSrc).indexOf("data:image/svg+xml") === 0) return;
    bindSectionalDiagramLightboxPopstateOnce();
    var root = ensureSectionalDiagramLightbox();
    bindSectionalDiagramLightboxEscapeOnce();
    var img = root._mtlLbImg;
    if (!img) return;
    if (root.classList.contains("is-open")) {
      img.alt = String(altText || "Configuration diagram");
      img.src = fullSrc;
      return;
    }

    var histOk = false;
    try {
      history.pushState({ mtlSectionalDiagramLb: 1 }, "", String(window.location.href || ""));
      histOk = true;
    } catch (ePs) {}
    root.removeAttribute("data-mtl-lb-history");
    if (histOk) root.setAttribute("data-mtl-lb-history", "1");

    img.alt = String(altText || "Configuration diagram");
    img.src = fullSrc;
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    try {
      document.body.classList.add("mtl-sectional-diagram-lightbox-open");
    } catch (eB2) {}
    var cb = root.querySelector(".mtl-sectional-diagram-lightbox__close");
    if (cb) {
      try {
        cb.focus();
      } catch (eF) {}
    }
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
          mtlSyncSectionalLeatherFromDom();
          scheduleSectionalLeatherBootstrap();
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
      } else {
        image = resolveSectionalDiagramAssetUrl(image);
      }
      var priceDiff = jsonHit && jsonHit.priceDiff != null ? jsonHit.priceDiff : null;
      var jsonPdNum = jsonHit && jsonHit.priceDiff != null ? Number(jsonHit.priceDiff) : null;
      var inferredUp = parseUpchargeFromOptionText(rawText);
      var upcharge = jsonPdNum != null && isFinite(jsonPdNum) ? jsonPdNum : inferredUp;

      var configurationTitle =
        jsonHit && jsonHit.configurationTitle != null ? String(jsonHit.configurationTitle).trim() : "";
      var dimensionsIn =
        jsonHit && jsonHit.dimensionsIn != null ? String(jsonHit.dimensionsIn).trim() : "";
      var dimensionsCm =
        jsonHit && jsonHit.dimensionsCm != null ? String(jsonHit.dimensionsCm).trim() : "";

      merged.push({
        code: mergedCode,
        nativeValue: opt.value,
        label: label,
        configurationTitle: configurationTitle,
        description: desc,
        dimensionsIn: dimensionsIn,
        dimensionsCm: dimensionsCm,
        image: image,
        priceDiff: priceDiff,
        upcharge: upcharge,
        rawOptionText: rawText,
        base: !!(jsonHit && jsonHit.base),
      });
    });

    return merged;
  }

  /** Template PDP accordion already exposes Product Summary; keep legacy row hidden vs duplicating triggers. */
  function ensureInlineProductSummaryVisibleWithPlannerHidden() {
    if (!document.documentElement.classList.contains("is-sectional-product")) return;
    if (document.getElementById("mc-pdp-accordion")) return;
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
    if (!isSectionalProductPageClient()) return;
    if (document.documentElement.dataset.mtlSectionalLeatherRetriesInstalled === "1") return;
    document.documentElement.dataset.mtlSectionalLeatherRetriesInstalled = "1";
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
    if (!document.documentElement.dataset.mtlMcTryInitLadderScheduled) {
      document.documentElement.dataset.mtlMcTryInitLadderScheduled = "1";
      [400, 1200, 2500, 5000, 9000].forEach(function (ms) {
        window.setTimeout(function () {
          var st = document.querySelector("#mcLeatherSwatchStrip");
          if (st && st.dataset.mtlSwatchesRendered === "true" && st.children.length > 0) return;
          if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
        }, ms);
      });
    }
  }

  /**
   * Walk every <select> on the page and log why each is/isn't classified as the leather control.
   * Returns a short string summary for the on-page debug box ("3 selects: 1 cfg, 0 leather, 2 other").
   */
  function mtlDumpLeatherDiscoveryToConsole(reason) {
    try {
      var allSelects = Array.from(document.querySelectorAll("select"));
      var optsTable =
        document.querySelector("#v65-product-parent #options_table") ||
        document.querySelector("#options_table") ||
        document.querySelector("#v65-product-parent table[id*='options_table']") ||
        document.querySelector("table[id*='options_table']") ||
        document.querySelector("#content_area table[id*='options_table']");
      var atcForm =
        document.querySelector('form[action*="ProductDetails"]') ||
        document.querySelector('form[action*="productdetails"]') ||
        document.querySelector('form[action*="shoppingcart"]');
      var v65 = document.getElementById("v65-product-parent");

      console.groupCollapsed(
        "[MTL leather-debug] %s — selects=%d, optsTable=%s, atcForm=%s, v65-product-parent=%s",
        String(reason || "scan"),
        allSelects.length,
        optsTable ? "yes" : "NO",
        atcForm ? "yes" : "NO",
        v65 ? "yes" : "NO"
      );

      var cfgCount = 0;
      var leatherishCount = 0;
      var otherCount = 0;
      var i;
      for (i = 0; i < allSelects.length; i++) {
        var sel = allSelects[i];
        var info = {};
        info.index = i;
        info.id = sel.id || "";
        info.name = sel.name || "";
        info.className = sel.className || "";
        info.inOptionsTable = !!(optsTable && optsTable.contains(sel));
        info.inAtcForm = !!(atcForm && atcForm.contains(sel));
        info.inV65 = !!(v65 && v65.contains(sel));
        info.optionCount = sel.options ? sel.options.length : 0;
        var firstOpts = [];
        var oi;
        for (oi = 0; oi < Math.min(info.optionCount, 6); oi++) {
          firstOpts.push(
            (oi + ":") + String((sel.options[oi].textContent || "").replace(/\s+/g, " ").trim()).slice(0, 80)
          );
        }
        info.firstOptions = firstOpts;
        info.rowText = "";
        try {
          var tr = sel.closest("tr");
          if (tr) info.rowText = String(tr.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160);
        } catch (eR) {}
        info.labelText = "";
        try {
          if (sel.id) {
            var idEsc =
              typeof CSS !== "undefined" && typeof CSS.escape === "function"
                ? CSS.escape(String(sel.id))
                : String(sel.id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            var lab = document.querySelector('label[for="' + idEsc + '"]');
            if (lab) info.labelText = String(lab.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160);
          }
        } catch (eL) {}
        try {
          info.isCfgRow = !!isVolusionConfigurationRowSelect(sel);
        } catch (eCfg) {
          info.isCfgRow = "ERR";
        }
        var realLeather = 0;
        try {
          var k;
          for (k = 0; k < info.optionCount; k++) {
            if (!isPlaceholderLeatherOption(sel.options[k])) realLeather++;
          }
        } catch (eP) {}
        info.realLeatherOptionCount = realLeather;
        var rowLow = (info.rowText + " " + info.labelText).toLowerCase();
        info.rowLooksLeatherish =
          /(choose cover|choose leather|select leather|select a leather|upholstery|cover|fabric|grade|swatch|palliser|material|color\s*choice)/i.test(
            rowLow
          );
        if (info.isCfgRow === true) cfgCount++;
        else if (info.rowLooksLeatherish || realLeather > 0) leatherishCount++;
        else otherCount++;
        console.log("[MTL leather-debug] select #" + i, info);
      }

      var cfgSel = null;
      try {
        cfgSel = findConfigurationSelect();
      } catch (eC2) {}
      var leSel = null;
      try {
        leSel = findNativeLeatherSelectEl();
      } catch (eL2) {}
      console.log("[MTL leather-debug] findConfigurationSelect ->", cfgSel);
      console.log("[MTL leather-debug] findNativeLeatherSelectEl ->", leSel);
      console.log("[MTL leather-debug] __WM_LEATHER_OPTIONS__ length=", (window.__WM_LEATHER_OPTIONS__ || []).length);
      console.groupEnd();

      var pickedInfo = "none";
      var pickedReason = "";
      if (leSel) {
        var realCount = 0;
        var firstLabel = "";
        var firstOpt = "";
        var sampleLabels = [];
        var k2;
        for (k2 = 0; k2 < (leSel.options || []).length; k2++) {
          var opt = leSel.options[k2];
          var txt = String((opt && opt.textContent) || "").replace(/\s+/g, " ").trim();
          if (k2 === 0) firstOpt = txt;
          var isPlaceholder = false;
          try { isPlaceholder = !!isPlaceholderLeatherOption(opt); } catch (eIP) {}
          if (!isPlaceholder) {
            realCount++;
            if (!firstLabel) firstLabel = txt;
            if (sampleLabels.length < 3) sampleLabels.push(txt.slice(0, 32));
          } else if (sampleLabels.length < 3) {
            sampleLabels.push("[ph]" + txt.slice(0, 26));
          }
        }
        var leId = leSel.id || leSel.name || ("<select>");
        pickedInfo =
          leId +
          " opts=" + ((leSel.options || []).length) +
          " real=" + realCount +
          " 1st='" + firstOpt.slice(0, 36) + "'";
        if (realCount === 0) {
          pickedReason = "ALL_PLACEHOLDER (Volusion likely waiting on config pick)";
        } else {
          pickedReason = "OK first_real='" + firstLabel.slice(0, 36) + "'";
        }
        console.log("[MTL leather-debug] picked sample labels:", sampleLabels);
      } else {
        pickedReason = "findNativeLeatherSelectEl returned null";
      }

      var selSummaries = [];
      var sIdx;
      for (sIdx = 0; sIdx < allSelects.length; sIdx++) {
        var sS = allSelects[sIdx];
        var sId = String(sS.id || sS.name || ("sel#" + sIdx));
        var sIsCfg = false;
        try { sIsCfg = !!isVolusionConfigurationRowSelect(sS); } catch (eS) {}
        var sRow = "";
        try {
          var sTr = sS.closest("tr");
          if (sTr) sRow = String(sTr.innerText || "").replace(/\s+/g, " ").trim();
        } catch (eR2) {}
        var sLabel = "";
        try {
          if (sS.id) {
            var sIdEsc =
              typeof CSS !== "undefined" && typeof CSS.escape === "function"
                ? CSS.escape(String(sS.id))
                : String(sS.id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            var sLabEl = document.querySelector('label[for="' + sIdEsc + '"]');
            if (sLabEl) sLabel = String(sLabEl.textContent || "").replace(/\s+/g, " ").trim();
          }
        } catch (eL3) {}
        var sFirst = "";
        if (sS.options && sS.options[0]) {
          sFirst = String(sS.options[0].textContent || "").replace(/\s+/g, " ").trim();
        }
        selSummaries.push(
          "[" + sIdx + (sIsCfg ? " CFG" : "") + "] id=" + sId.slice(0, 24) +
          " opts=" + (sS.options ? sS.options.length : 0) +
          " 1st='" + sFirst.slice(0, 30) + "'" +
          " row='" + sRow.slice(0, 50) + "'" +
          (sLabel ? " lab='" + sLabel.slice(0, 30) + "'" : "")
        );
      }

      var summary =
        "sel=" + allSelects.length +
        " cfg=" + cfgCount +
        " leatherish=" + leatherishCount +
        " other=" + otherCount +
        " optsTbl=" + (optsTable ? "Y" : "N") +
        " atcForm=" + (atcForm ? "Y" : "N") +
        "\n  picked: " + pickedInfo +
        "\n  reason: " + pickedReason +
        (selSummaries.length ? "\n  " + selSummaries.join("\n  ") : "");
      try {
        __mtlDiag.leatherDebug = summary;
        mtlRefreshStageTrackerDom();
      } catch (eD) {}
      return summary;
    } catch (eAll) {
      console.error("[MTL leather-debug] dump failed:", eAll);
      return "dump-failed";
    }
  }
  window.mtlDumpLeatherDiscoveryToConsole = mtlDumpLeatherDiscoveryToConsole;

  /** Called by template's renderAllGradesTogether() when its own `all` array is empty. */
  window.mtlFillSectionalLeatherModal = function mtlFillSectionalLeatherModal() {
    if (!isSectionalProductPageClient()) return;
    if (typeof window.mcTryInitWmLeather === "function") {
      window.mcTryInitWmLeather();
    }
    mtlRefreshSectionalLeatherUi();
    console.log("[MTL] mtlFillSectionalLeatherModal — delegated to theater mcTryInitWmLeather");
    /* Update overlay in real time so we can see modal state after opening. */
    window.setTimeout(function () {
      try {
        var ws2 = document.getElementById("wmSections");
        var grid = ws2 && ws2.querySelector(".mtl-leather-modal-grid");
        var tiles = ws2 && ws2.querySelectorAll(".wm-tile");
        var cards = grid && grid.querySelectorAll(".mtl-leather-modal-card");
        var body = ws2 && ws2.closest(".wm-modal-body");
        var bodyH = body ? String(body.offsetHeight) + "px" : "—";
        var wsH = ws2 ? String(ws2.offsetHeight) + "px" : "—";
        __mtlDiag.leatherDebug =
          "modal opened: grid=" + (grid ? "YES" : "NO") +
          " cards=" + (cards ? cards.length : 0) +
          " wm-tiles=" + (tiles ? tiles.length : 0) +
          " ws.h=" + wsH + " body.h=" + bodyH;
        mtlRefreshStageTrackerDom();
      } catch (eD2) {}
    }, 60);
  };

  /** Snapshot what is in #wmSections any time; call from DevTools or triggered on modal open. */
  window.mtlInspectModalSections = function () {
    var ws = document.getElementById("wmSections");
    if (!ws) { console.log("[MTL inspect] #wmSections: NOT FOUND"); return; }
    var grid = ws.querySelector(".mtl-leather-modal-grid");
    var cards = ws.querySelectorAll(".mtl-leather-modal-card");
    var tiles = ws.querySelectorAll(".wm-tile");
    var gradeRows = ws.querySelectorAll(".wm-grade-row");
    var body = ws.closest(".wm-modal-body");
    console.log("[MTL inspect] #wmSections children:", ws.children.length);
    console.log("[MTL inspect] .mtl-leather-modal-grid:", grid ? "found" : "none");
    console.log("[MTL inspect] .mtl-leather-modal-card count:", cards.length);
    console.log("[MTL inspect] .wm-tile count:", tiles.length);
    console.log("[MTL inspect] .wm-grade-row count:", gradeRows.length);
    console.log("[MTL inspect] #wmSections offsetHeight:", ws.offsetHeight);
    console.log("[MTL inspect] .wm-modal-body offsetHeight:", body ? body.offsetHeight : "—");
    console.log("[MTL inspect] #wmSections innerHTML slice:", ws.innerHTML.slice(0, 400));
    if (grid) console.log("[MTL inspect] grid style.display:", window.getComputedStyle(grid).display);
  };

  function mtlRunStagePanel(stageLogName, panelKey, fn) {
    console.log("[MTL] START " + stageLogName);
    try {
      var r = fn();
      console.log("[MTL] SUCCESS " + stageLogName);
      return r;
    } catch (err) {
      console.error("[MTL] FAILURE " + stageLogName, err);
      if (err && err.stack) console.error(err.stack);
      if (panelKey && __mtlDiag) {
        __mtlDiag[panelKey] = "FAILED";
        mtlRefreshStageTrackerDom();
      }
      return null;
    }
  }

  function finalizeSectionalUi(section) {
    var leatherSelNow = null;

    mtlRunStagePanel("finalize: sectional leather bootstrap", "leatherOpts", function () {
      bootstrapSectionalLeatherUi();
      leatherSelNow = findNativeLeatherSelectEl();
    });

    mtlRunStage("finalize: chrome & dedupe", function () {
      try {
        document.documentElement.classList.add("has-sectional-config-cards");
      } catch (eCls) {}
      if (section && section.id === "mtl-sectional-configurations") {
        try {
          section.setAttribute("data-mtl-generated", "true");
          section.setAttribute("data-mtl-sectional-generated", "true");
        } catch (eSecTag) {}
      }
      removeStandaloneDuplicateProductSummary();
    });

    mtlRunStagePanel("finalize: leather modal refresh", "leatherModal", function () {
      mtlRefreshSectionalLeatherUi();
      var ws = document.getElementById("wmSections");
      var nModal = ws ? ws.querySelectorAll(".wm-tile").length : 0;
      console.log("[MTL] .wm-tile count in #wmSections:", nModal);
      __mtlDiag.leatherModal = document.getElementById("wmOpen") ? "YES" : "NO";
      mtlRefreshStageTrackerDom();
      if (__mtlDiag.leatherOpts !== "YES") {
        mtlDumpLeatherDiscoveryToConsole("finalize: leather options = NO");
        [800, 2200, 5000].forEach(function (ms) {
          window.setTimeout(function () {
            var st = document.querySelector("#mcLeatherSwatchStrip");
            if (st && st.dataset.mtlSwatchesRendered === "true" && st.children.length > 0) return;
            if (__mtlDiag.leatherOpts === "YES") return;
            bootstrapSectionalLeatherUi();
            if (__mtlDiag.leatherOpts !== "YES") {
              mtlDumpLeatherDiscoveryToConsole("retry@" + ms + "ms");
            }
          }, ms);
        });
      }
    });

    mtlRunStage("finalize: misc links & template refresh", function () {
      applyAlulaPalliserPdfHref();
      if (typeof window.mcRefreshProductSummaryButton === "function") {
        window.mcRefreshProductSummaryButton();
      }
      var legacyToggle = document.getElementById("mtl-sectional-more-native");
      if (legacyToggle) legacyToggle.remove();
    });

    mtlRunStage("finalize: accordion popular configs", function () {
      function syncAccordionPopularAndSummary() {
        mountPopularConfigurationsInAccordion(section);
        ensureProductSummary(section);
        bindViewAllLeathersButtons();
        try {
          bindConfigurationCardClicks();
        } catch (eBnd) {}
        try {
          updateProductSummary();
        } catch (eUpd) {}
      }
      syncAccordionPopularAndSummary();
      /* Accordion run() repeats at ~400ms/1200ms; late mount otherwise yields “nothing changed” + stale script cache. */
      [450, 1100, 2400].forEach(function (ms) {
        window.setTimeout(syncAccordionPopularAndSummary, ms);
      });
    });

    mtlRunStage("finalize: restore saved sectional configuration", function () {
      scheduleSectionalConfigRestore();
    });

    mtlRunStagePanel("finalize: product summary DOM", "productSummary", function () {
      ensureProductSummary(section);
      var sum = document.getElementById("mtl-product-summary");
      console.log(
        "[MTL] Product Summary container #mtl-product-summary:",
        sum ? "found" : "null",
        "parentNode:",
        sum && sum.parentNode ? "yes" : "no"
      );
      __mtlDiag.productSummary = sum && sum.parentNode ? "YES" : "NO";
      mtlRefreshStageTrackerDom();
    });

    mtlRunStage("finalize: planner row visibility", function () {
      ensureInlineProductSummaryVisibleWithPlannerHidden();
    });

    mtlRunStage("finalize: layout move & ATC", function () {
      scheduleMoveLeatherAboveConfigurations(section);
      scheduleSectionalAtcChrome();
      [150, 600, 1500, 3200].forEach(function (ms) {
        window.setTimeout(function () {
          var sumAtc = document.getElementById("mtl-product-summary");
          if (sumAtc) mountProductSummaryAboveAtc(sumAtc);
        }, ms);
      });
    });

    mtlRunStage("finalize: config cards bind & observers", function () {
      bindConfigurationCardClicks();
      ensureObservers();
      ensureMemberClassObserver();
      syncCardsSelectionHighlight();
    });

    mtlRunStagePanel("finalize: pricing box", "pricingBox", function () {
      var selList = [
        "#v65-product-parent #priceWithOptions",
        "#content_area #priceWithOptions",
        "#priceWithOptions",
        "#v65-product-parent #priceWithOptionsNoTax",
      ];
      var priceHit = null;
      var si;
      for (si = 0; si < selList.length; si++) {
        priceHit = document.querySelector(selList[si]);
        if (priceHit) break;
      }
      console.log("[MTL] pricing box target: tried", selList, "=>", priceHit ? "hit" : "all null");
      updateProductSummary();
      var elP = document.getElementById("mtl-sum-price");
      __mtlDiag.pricingBox = elP ? "YES" : "NO";
      mtlRefreshStageTrackerDom();
    });

    mtlRunStage("finalize: card price badges", function () {
      updateSectionalCardPriceBadges();
    });

    mtlRunStage("finalize: wm leather init", function () {
      if (typeof window.mcTryInitWmLeather === "function") window.mcTryInitWmLeather();
    });

    mtlRunStagePanel("finalize: mini swatch strip", "miniSwatches", function () {
      mtlRefreshSectionalLeatherUi();
      var strip = document.getElementById("mcLeatherSwatchStrip");
      var nMini = strip
        ? strip.querySelectorAll(".mc-leather-mini-swatch, .mc-mini-swatch").length
        : 0;
      console.log("[MTL] mini swatch nodes in #mcLeatherSwatchStrip:", nMini);
      __mtlDiag.miniSwatches = nMini > 0 ? "YES" : "NO";
      mtlRefreshStageTrackerDom();
      leatherSelNow = leatherSelNow || findNativeLeatherSelectEl();
      if (leatherSelNow && leatherSelNow.dataset.mtlMiniStripBound !== "1") {
        leatherSelNow.dataset.mtlMiniStripBound = "1";
        leatherSelNow.addEventListener("change", function () {
          if (typeof window.mcSyncLeatherSummary === "function") window.mcSyncLeatherSummary();
        });
      }
    });
  }

  function renderSectionalPdp() {
    window.__mtlReplacementRenderSucceeded = false;

    if (isTheaterSeatingProductPageForGuard() || !isSectionalProductPageClient()) {
      return;
    }

    scheduleSectionalLeatherBootstrap();

    var misLeather = document.querySelectorAll("#v65-product-parent select.mc-native-leather, #options_table select.mc-native-leather");
    Array.prototype.forEach.call(misLeather, function (sel) {
      if (isVolusionConfigurationRowSelect(sel)) sel.classList.remove("mc-native-leather");
      else if (mtlRejectAsLeatherSource(sel)) sel.classList.remove("mc-native-leather");
    });

    var allConfigs = window.MTL_SECTIONAL_CONFIGS || {};
    sectionalLog("sectional configs keys", Object.keys(allConfigs));

    var pcInput = document.querySelector('input[name="ProductCode"], input[name="productcode"]');
    var pcVal = pcInput ? String(pcInput.value || "").trim() : "";

    var productKey = resolveSectionalProductStyleKey(pcVal, allConfigs);

    var jsonFromKey = productKey ? allConfigs[productKey] : [];
    if (!Array.isArray(jsonFromKey)) jsonFromKey = [];

    console.log("[MTL] configuration JSON records (from MTL_SECTIONAL_CONFIGS) count:", jsonFromKey.length, "productKey:", productKey, "records:", jsonFromKey);

    sectionalLog("sectional productKey", productKey, "json count", jsonFromKey.length);

    var secExistingEarly = document.getElementById("mtl-sectional-configurations");
    var cardDomVersionWanted = String(window.MTL_RENDERER_BUILD || "").trim();
    if (secExistingEarly && secExistingEarly.dataset.mtlFinalInit === "1") {
      var cardDomVersionHave = String(secExistingEarly.getAttribute("data-mtl-card-dom-v") || "").trim();
      if (cardDomVersionWanted && cardDomVersionHave !== cardDomVersionWanted) {
        secExistingEarly.removeAttribute("data-mtl-final-init");
        sectionalLog("sectional rebuild: card DOM version", cardDomVersionHave, "->", cardDomVersionWanted);
      }
      var haveStyle = String(secExistingEarly.getAttribute("data-mtl-resolved-style") || "").trim();
      var wantStyle = String(productKey || "").trim();
      if (wantStyle !== haveStyle) {
        secExistingEarly.removeAttribute("data-mtl-final-init");
        sectionalLog("sectional rebuild: resolved style", haveStyle, "->", wantStyle);
      }
    }
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
      __mtlDiag.configData = "YES";
      __mtlDiag.configCards =
        secExistingEarly.querySelectorAll(".mtl-sectional-card").length > 0 ? "YES" : "NO";
      mtlRefreshStageTrackerDom();
      mountPopularConfigurationsInAccordion(secExistingEarly);
      console.log("[MTL] START finalize (existing mounted section)");
      try {
        finalizeSectionalUi(secExistingEarly);
        console.log("[MTL] SUCCESS finalize (existing mounted section)");
      } catch (errFin) {
        console.error("[MTL] FAILURE finalize (existing mounted section)", errFin);
        if (errFin && errFin.stack) console.error(errFin.stack);
      }
      window.__mtlReplacementRenderSucceeded = __mtlDiag.configCards === "YES";
      if (window.__mtlReplacementRenderSucceeded) scheduleHideConfigurationRow();
      var selLog = findConfigurationSelect();
      sectionalLog("sectional config select", selLog);
      sectionalLog("selected sectional config", window.__mtlSectionalSelectedConfig);
      sectionalLog("native config select value", selLog && selLog.value);
      return;
    }

    var configSelect = null;
    var merged = [];

    console.log("[MTL] START configuration parsing");
    try {
      configSelect = findConfigurationSelect();
      sectionalLog("sectional config select", configSelect);
      if (!configSelect) {
        console.warn("[MTL] configuration <select> not found (findConfigurationSelect returned null)");
        __mtlDiag.configData = "NO";
        __mtlDiag.configCards = "NO";
        mtlRefreshStageTrackerDom();
        scheduleSectionalLeatherBootstrap();
        console.log("[MTL] SUCCESS configuration parsing (no select to parse)");
        return;
      }
      merged = mergeNativeOptionsWithJson(configSelect, jsonFromKey, productKey, pcVal);
      console.log("[MTL] mergeNativeOptionsWithJson merged count:", merged.length, "merged array:", merged);
      if (!merged.length) {
        __mtlDiag.configData = "NO";
        __mtlDiag.configCards = "NO";
        mtlRefreshStageTrackerDom();
        scheduleSectionalLeatherBootstrap();
        console.warn("[MTL] No Volusion configuration options to display as cards.", productKey);
        console.log("[MTL] SUCCESS configuration parsing (zero merged rows)");
        return;
      }
      __mtlDiag.configData = "YES";
      mtlRefreshStageTrackerDom();
      console.log("[MTL] SUCCESS configuration parsing");
    } catch (errParse) {
      console.error("[MTL] FAILURE configuration parsing", errParse);
      if (errParse && errParse.stack) console.error(errParse.stack);
      __mtlDiag.configData = "FAILED";
      __mtlDiag.configCards = "NO";
      mtlRefreshStageTrackerDom();
      return;
    }

    mtlRemoveSectionalGeneratedChrome();

    try {
      (function orderBasePriceConfigurationFirst() {
        function up(c) {
          return effectiveConfigurationUpcharge(c);
        }
        var ups = merged.map(up);
        var minU = ups.length ? Math.min.apply(null, ups) : 0;
        var candIdx = [];
        var i;
        for (i = 0; i < merged.length; i++) {
          if (up(merged[i]) === minU) candIdx.push(i);
        }
        var defI = candIdx.length ? candIdx[0] : 0;
        var k;
        var j;
        for (k = 0; k < candIdx.length; k++) {
          j = candIdx[k];
          if (normalizeCode(merged[j].code) === "07-15") {
            defI = j;
            break;
          }
        }
        if (normalizeCode(merged[defI].code) !== "07-15") {
          for (k = 0; k < candIdx.length; k++) {
            j = candIdx[k];
            if (merged[j].base === true) {
              defI = j;
              break;
            }
          }
        }
        var first = merged[defI];
        var rest = merged.filter(function (_, idx) {
          return idx !== defI;
        });
        merged.length = 0;
        merged.push.apply(merged, [first].concat(rest));
      })();
    } catch (errOrd) {
      console.error("[MTL] FAILURE orderBasePriceConfigurationFirst", errOrd);
      if (errOrd && errOrd.stack) console.error(errOrd.stack);
    }

    try {
      document.documentElement.classList.add("is-sectional-product");
    } catch (eSecHtml) {}

    state.cfgByCode = {};
    state.cfgByNativeValue = {};
    merged.forEach(function (c) {
      if (c && c.code) state.cfgByCode[normalizeCode(c.code)] = c;
      if (c && c.nativeValue != null) state.cfgByNativeValue[String(c.nativeValue)] = c;
    });

    console.log("[MTL] START configuration cards render");
    var section = null;
    try {
      var existing = document.getElementById("mtl-sectional-configurations");
      section = existing || document.createElement("section");
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
        card.className = "mtl-sectional-card mtl-sectional-card--pdf-diagram";
        card.setAttribute("data-config-code", cfg.code || "");
        card.setAttribute("data-config-value", cfg.nativeValue != null ? String(cfg.nativeValue) : "");
        if (cfg.priceDiff != null && cfg.priceDiff !== "") {
          card.setAttribute("data-mtl-price-diff", String(cfg.priceDiff));
        }

        var body = document.createElement("div");
        body.className = "mtl-sectional-card-body";

        var figure = document.createElement("figure");
        figure.className = "mtl-sectional-figure";

        var img = document.createElement("img");
        img.className = "mtl-sectional-image";
        var src = String(cfg.image || "").trim();
        if (!src) {
          img.src = PLACEHOLDER_SVG;
        } else {
          img.src = src.indexOf("?") === -1 ? src + "?v=" + IMG_V : src + "&v=" + IMG_V;
        }
        var altLabel =
          [
            productKey ? String(productKey).trim() : "",
            cfg.configurationTitle ? String(cfg.configurationTitle).trim() : "",
            formatDiagramConfigCode(cfg.code),
          ]
            .filter(function (x) {
              return !!x;
            })
            .join(" — ");
        img.alt = altLabel || cfg.label || cfg.code || "Configuration diagram";
        try {
          img.draggable = false;
        } catch (eDrag) {}
        figure.appendChild(img);

        var zoomBtn = document.createElement("button");
        zoomBtn.type = "button";
        zoomBtn.className = "mtl-sectional-diagram-zoom";
        zoomBtn.setAttribute(
          "aria-label",
          "Enlarge configuration diagram. Click the picture to choose this configuration and update price."
        );
        zoomBtn.setAttribute("title", "Enlarge diagram");
        zoomBtn.innerHTML =
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>';
        figure.appendChild(zoomBtn);

        body.appendChild(figure);
        card.appendChild(body);
        grid.appendChild(card);
      });

      inner.appendChild(h);
      inner.appendChild(grid);
      section.innerHTML = "";
      section.appendChild(inner);
      try {
        section.setAttribute("data-mtl-generated", "true");
        section.setAttribute("data-mtl-sectional-generated", "true");
      } catch (eSecAttr) {}

      var popHost = document.querySelector("#mc-acc-row-popularconfig .mc-acc-content--popular-host");
      var target = findInsertTarget();
      var targetChain =
        "#mc-acc-row-popularconfig .mc-acc-content--popular-host, #options_table, #v65-product-parent, #content_area, document.body";
      if (!target && !popHost) {
        console.error("[MTL] FAILURE configuration cards render — insert target null", targetChain);
        __mtlDiag.configCards = "FAILED";
        mtlRefreshStageTrackerDom();
        return;
      }
      if (popHost && (!existing || !popHost.contains(section))) {
        try {
          popHost.appendChild(section);
          console.log("[MTL] config renderer mounted in accordion host (initial insert)");
        } catch (errHost) {
          console.error("[MTL] FAILURE configuration cards render accordion host", errHost);
        }
      } else if (!existing || (target && !target.contains(section))) {
        try {
          target.insertAdjacentElement("afterend", section);
        } catch (errIns) {
          console.error("[MTL] FAILURE configuration cards render insertAdjacentElement", errIns, targetChain);
          if (errIns && errIns.stack) console.error(errIns.stack);
          __mtlDiag.configCards = "FAILED";
          mtlRefreshStageTrackerDom();
          return;
        }
      }
      __mtlDiag.configCards = section.querySelectorAll(".mtl-sectional-card").length > 0 ? "YES" : "NO";
      mtlRefreshStageTrackerDom();
      var cardCountDone = section.querySelectorAll(".mtl-sectional-card").length;
      console.log("[MTL] SUCCESS configuration cards render; cards:", cardCountDone);
      console.log("[MTL] config data loaded —", cardCountDone, "card(s)");
    } catch (errCards) {
      console.error("[MTL] FAILURE configuration cards render", errCards);
      if (errCards && errCards.stack) console.error(errCards.stack);
      __mtlDiag.configCards = "FAILED";
      mtlRefreshStageTrackerDom();
      return;
    }

    console.log("[MTL] START post-cards finalize pipeline");
    try {
      finalizeSectionalUi(section);
      console.log("[MTL] SUCCESS post-cards finalize pipeline");
    } catch (errFin2) {
      console.error("[MTL] FAILURE post-cards finalize pipeline", errFin2);
      if (errFin2 && errFin2.stack) console.error(errFin2.stack);
    }

    try {
      syncCardsSelectionHighlight();
      var cs0 = findConfigurationSelect();
      if (cs0 && cs0.selectedOptions && cs0.selectedOptions[0]) {
        var opt0 = cs0.selectedOptions[0];
        window.__mtlSectionalPreferredNativeValue = opt0.value;
        window.__mtlSectionalSelectedConfig = extractPrimaryCode(opt0.textContent || "");
      }
      mtlRefreshSectionalLeatherUi();
    } catch (errSync) {
      console.warn("[MTL] post-cards Volusion sync (no forced configuration)", errSync);
    }

    sectionalLog("selected sectional config", window.__mtlSectionalSelectedConfig);
    sectionalLog("native config select value", findConfigurationSelect() && findConfigurationSelect().value);

    if (section && __mtlDiag.configCards === "YES") {
      section.dataset.mtlFinalInit = "1";
      try {
        section.setAttribute("data-mtl-card-dom-v", String(window.MTL_RENDERER_BUILD || "").trim());
        section.setAttribute("data-mtl-resolved-style", String(productKey || "").trim());
      } catch (eV) {}
      window.__mtlReplacementRenderSucceeded = true;
      scheduleHideConfigurationRow();
    }
    sectionalLog("sectional diagram cards inserted:", merged.length);
  }

  window.MTL_runRender = runRender;

  function runRender() {
    ensureMtlStageTrackerDom();
    __mtlDiag.configData =
      __mtlDiag.configCards =
      __mtlDiag.pricingBox =
      __mtlDiag.productSummary =
      __mtlDiag.leatherOpts =
      __mtlDiag.leatherModal =
      __mtlDiag.miniSwatches =
        "NO";
    __mtlDiag.page = "—";
    mtlRefreshStageTrackerDom();

    console.log("[MTL] START page detection");
    try {
      stripSectionalHtmlClassIfTheater();
      removeMtlDebugPanelIfPresent();

      var kind = detectPageKindForMtlDiagnostics();
      __mtlDiag.page = kind;
      mtlRefreshStageTrackerDom();
      console.log("[MTL] PAGE TYPE (diagnostics):", kind);
      console.log("[MTL] page classification:", kind, "(theater guard:", isTheaterSeatingProductPageForGuard(), "sectional client:", isSectionalProductPageClient(), ")");

      if (isTheaterSeatingProductPageForGuard()) {
        console.log("[MTL] SUCCESS page detection — THEATER (sectional renderer stopped here)");
        return;
      }
      if (!isSectionalProductPageClient()) {
        console.log("[MTL] SUCCESS page detection — not sectional client (sectional renderer stopped here)");
        return;
      }
      console.log("[MTL] SUCCESS page detection — proceeding to renderSectionalPdp");

      scheduleSectionalLeatherBootstrap();
      renderSectionalPdp();
    } catch (err) {
      console.error("[MTL] FAILURE page detection / runRender", err);
      if (err && err.stack) console.error(err.stack);
      __mtlDiag.page = "FAILED";
      mtlRefreshStageTrackerDom();
    }
  }

  window.findConfigurationSelect = findConfigurationSelect;

  /** Console helper: run after page load (open modal to test modal card count). */
  window.MTL_verifySectionalLeatherUi = function () {
    if (isTheaterSeatingProductPageForGuard()) {
      console.log("[MTL verify] Skipped — theater seating PDP (sectional renderer inactive).");
      return { skipped: "theater" };
    }
    var ws = document.getElementById("wmSections");
    var strip = document.getElementById("mcLeatherSwatchStrip");
    var sec = document.getElementById("mtl-sectional-configurations");
    var row = document.getElementById("mcPlannerRow");
    var ot = document.querySelector("#v65-product-parent #options_table, #v65-product-parent table[id*='options_table']");
    var rep = {};
    try {
      rep = {
        modalNativeCards: ws ? ws.querySelectorAll(".mtl-leather-modal-card").length : 0,
        miniChips: strip ? strip.querySelectorAll(".mc-leather-mini-swatch").length : 0,
        productSummaryImmediatelyBeforePopular: !!(sec && row && sec.previousElementSibling === row),
        optionsTableMarginTop: ot && window.getComputedStyle ? window.getComputedStyle(ot).marginTop : "",
      };
    } catch (eV) {
      rep.error = String(eV.message || eV);
    }
    console.log("[MTL verify] Open leather modal to refresh modal card count.", rep);
    return rep;
  };

  function boot() {
    mtlRemoveLeatherPickerHint();
    stripSectionalHtmlClassIfTheater();
    removeMtlDebugPanelIfPresent();
    ensureMcWmOpenMountedListener();
    if (isSectionalProductPageClient()) scheduleSectionalLeatherBootstrap();
    if (SECTIONAL_DBG && isSectionalProductPageClient() && !isTheaterSeatingProductPageForGuard()) {
      window.setTimeout(function () {
        runMtlSectionalDiagnosticConsoleOnly("after DOMContentLoaded (0ms tick)");
      }, 0);
      window.setTimeout(function () {
        runMtlSectionalDiagnosticConsoleOnly("t+1500ms");
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

/* MC_SITE_FIX_BUILD_20260518b — inlined from vspfiles/js/mc-site-fix.js (PLP mats + site-wide hero/logo) */
(function (global) {
  "use strict";
  if (global.__MC_SITE_FIX_LOADED__) return;
  global.__MC_SITE_FIX_LOADED__ = true;
  var MAT = "#f2f2f2";
  var TILE_H = 280;
  var STAGE_H = 220;
  var TILE_H_M = 220;
  var STAGE_H_M = 172;
  function isHomepage() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      var q = String(global.location.search || "");
      if (p === "/" || p === "/default.asp" || p === "/default.aspx") return true;
      if (/\/index\.html?$/i.test(p)) return true;
      if (global.mcPathIsHomepage && global.mcPathIsHomepage()) return true;
      if (/(?:^|[?&])page=home/i.test(q)) return true;
    } catch (eHome) {}
    return false;
  }
  function injectCriticalCss() {
    if (document.getElementById("mc-site-fix-critical")) return;
    var st = document.createElement("style");
    st.id = "mc-site-fix-critical";
    st.textContent =
      "body:not(.is-home) #if_homepage,body:not(.is-home) #slideshow-container," +
      "html:not(.mc-allow-home-hero) #if_homepage,html:not(.mc-allow-home-hero) #slideshow-container," +
      "body.category #if_homepage,body.category #slideshow-container," +
      "html.category #if_homepage,html.category #slideshow-container," +
      "html.is-category-or-listing-page #if_homepage,html.is-category-or-listing-page #slideshow-container{" +
      "display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;" +
      "max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;" +
      "opacity:0!important;pointer-events:none!important;background:transparent!important;border:0!important}" +
      "body:not(.is-home) #slideshow-container .mc-hero-video,body:not(.is-home) .mc-hero-video," +
      "html.category #slideshow-container .mc-hero-video{display:none!important;height:0!important;" +
      "min-height:0!important;overflow:hidden!important;opacity:0!important;background:transparent!important}" +
      "#display_homepage_title,#display_homepage_title *{display:none!important;visibility:hidden!important;" +
      "height:0!important;width:0!important;max-width:0!important;margin:0!important;padding:0!important;" +
      "overflow:hidden!important;opacity:0!important;pointer-events:none!important;font-size:0!important}" +
      "header.header .header__section>.col-xs-6.col-sm-8.col-md-9.col-lg-3:first-child{display:none!important;" +
      "width:0!important;padding:0!important;margin:0!important;overflow:hidden!important}" +
      "#content_area .v-product-grid a.v-product__img.mc-plp-thumb-mat," +
      ".v-product-grid a.v-product__img.mc-plp-thumb-mat{display:flex!important;align-items:flex-end!important;" +
      "justify-content:center!important;background:#f2f2f2!important;box-sizing:border-box!important;" +
      "height:280px!important;min-height:280px!important;max-height:280px!important;padding:14px!important;" +
      "overflow:hidden!important;width:100%!important;margin:0!important}" +
      "#content_area .v-product-grid a.v-product__img.mc-plp-thumb-mat>img," +
      ".v-product-grid a.v-product__img.mc-plp-thumb-mat>img{width:100%!important;height:220px!important;" +
      "max-height:220px!important;object-fit:contain!important;object-position:center bottom!important;" +
      "border:0!important;border-width:0!important;display:block!important;margin:0 auto!important;" +
      "background:transparent!important}" +
      "@media(max-width:991px){#content_area .v-product-grid a.v-product__img.mc-plp-thumb-mat," +
      ".v-product-grid a.v-product__img.mc-plp-thumb-mat{height:220px!important;min-height:220px!important;" +
      "max-height:220px!important;padding:12px!important}#content_area .v-product-grid a.v-product__img.mc-plp-thumb-mat>img," +
      ".v-product-grid a.v-product__img.mc-plp-thumb-mat>img{height:172px!important;max-height:172px!important}}";
    (document.head || document.documentElement).appendChild(st);
  }
  function hideHeroAndLogo() {
    var home = isHomepage();
    if (!home) {
      global.document.documentElement.classList.remove("mc-allow-home-hero");
      if (global.document.body) global.document.body.classList.remove("is-home");
    }
    var logo = document.getElementById("display_homepage_title");
    if (logo) {
      logo.style.setProperty("display", "none", "important");
      logo.style.setProperty("visibility", "hidden", "important");
      logo.style.setProperty("height", "0", "important");
      logo.style.setProperty("width", "0", "important");
      logo.style.setProperty("overflow", "hidden", "important");
      logo.style.setProperty("opacity", "0", "important");
    }
    if (home) return;
    document
      .querySelectorAll(
        "#if_homepage,#slideshow-container,#slideshow-container .mc-hero-video,.mc-hero-video"
      )
      .forEach(function (node) {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("min-height", "0", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
        node.style.setProperty("pointer-events", "none", "important");
        node.style.setProperty("background", "transparent", "important");
        node.style.setProperty("border", "0", "important");
      });
  }
  function applyPlpThumbs() {
    var mobile = global.innerWidth <= 991;
    var tileH = mobile ? TILE_H_M : TILE_H;
    var stageH = mobile ? STAGE_H_M : STAGE_H;
    var pad = mobile ? 12 : 14;
    document
      .querySelectorAll(
        "#content_area .v-product-grid a.v-product__img, .v-product-grid a.v-product__img"
      )
      .forEach(function (wrap) {
        if (!wrap || !wrap.closest || !wrap.closest(".v-product-grid")) return;
        if (wrap.closest("#v65-product-related")) return;
        wrap.classList.add("mc-plp-thumb-mat");
        wrap.style.setProperty("display", "flex", "important");
        wrap.style.setProperty("align-items", "flex-end", "important");
        wrap.style.setProperty("justify-content", "center", "important");
        wrap.style.setProperty("width", "100%", "important");
        wrap.style.setProperty("height", tileH + "px", "important");
        wrap.style.setProperty("min-height", tileH + "px", "important");
        wrap.style.setProperty("max-height", tileH + "px", "important");
        wrap.style.setProperty("margin", "0", "important");
        wrap.style.setProperty("padding", pad + "px", "important");
        wrap.style.setProperty("overflow", "hidden", "important");
        wrap.style.setProperty("box-sizing", "border-box", "important");
        wrap.style.setProperty("background", MAT, "important");
        wrap.style.setProperty("line-height", "0", "important");
        var img = wrap.querySelector("img");
        if (!img) return;
        img.style.setProperty("border", "0", "important");
        img.style.setProperty("border-width", "0", "important");
        img.style.setProperty("outline", "0", "important");
        img.style.setProperty("width", "100%", "important");
        img.style.setProperty("height", stageH + "px", "important");
        img.style.setProperty("max-width", "100%", "important");
        img.style.setProperty("max-height", stageH + "px", "important");
        img.style.setProperty("min-height", "0", "important");
        img.style.setProperty("object-fit", "contain", "important");
        img.style.setProperty("object-position", "center bottom", "important");
        img.style.setProperty("display", "block", "important");
        img.style.setProperty("margin", "0 auto", "important");
        img.style.setProperty("box-sizing", "border-box", "important");
        img.style.setProperty("background", "transparent", "important");
      });
  }
  function markCategoryPlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      if (/-s\//.test(p) && /\.html?/i.test(p)) {
        document.documentElement.classList.add("category");
        document.documentElement.setAttribute("data-mc-category-plp", "1");
        if (document.body) document.body.classList.add("category");
      }
    } catch (eCat) {}
  }
  function run() {
    injectCriticalCss();
    markCategoryPlp();
    hideHeroAndLogo();
    applyPlpThumbs();
  }
  run();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  }
  global.addEventListener("load", run);
  global.addEventListener("resize", applyPlpThumbs);
  [50, 150, 400, 800, 1500, 3000, 6000].forEach(function (ms) {
    global.setTimeout(run, ms);
  });
  if (typeof MutationObserver !== "undefined" && document.body) {
    var scheduled = false;
    var mo = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      global.requestAnimationFrame(function () {
        scheduled = false;
        run();
      });
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }
  global.mcSiteFixRun = run;
})(typeof window !== "undefined" ? window : this);

/* Load cache-busted enforcer (beats baked inline PLP CSS at ~line 16308) */
(function (w, d) {
  if (w.__MC_PLP_ENFORCER_LOADING__) return;
  w.__MC_PLP_ENFORCER_LOADING__ = 1;
  var s = d.createElement("script");
  s.src = "/v/vspfiles/js/mc-plp-enforcer.js?m=" + Date.now();
  (d.head || d.documentElement).appendChild(s);
})(window, document);
