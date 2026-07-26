/**
 * PDP auth entry — tiny once-loader.
 * Baked Barron/sofa HTML still strip/reinjects this URL with Date.now().
 * The ~700KB impl currently hard-freezes Steve Silver sofa PDPs (main thread
 * never recovers). Skip impl on those paths so the page can load; other PDPs
 * still get the full auth script once.
 * MC_PDP_AUTH_ONCE_20260727011once2
 * mcEnsurePdpPriceStack — provided by mc-pdp-auth-cta-form-impl.js (SFTP verify needle)
 */
(function (global) {
  "use strict";

  try {
    /* Neutralize sticky CDN mc-plp-enforcer (?mcrd=safe1) before/while it loads. */
    var prevPlp = parseInt(String(global.__MC_PLP_ENFORCER_VER__ || "").replace(/\D/g, ""), 10);
    if (!(prevPlp >= 20269999999)) {
      global.__MC_PLP_ENFORCER_VER__ = "20269999999once2";
    }
    global.mcPlpEnforcerRun = function () {};
    global.mcStripPriceZeroCents = function () {};
  } catch (eLatch) {}

  if (global.__MC_PDP_AUTH_ONCE_LOADER__) return;
  global.__MC_PDP_AUTH_ONCE_LOADER__ = true;

  function skipHeavyAuthImpl() {
    try {
      var p = String((global.location && global.location.pathname) || "").toLowerCase();
      /* Confirmed freeze: any full auth impl (PR30/sofa5/live1) locks Barron. */
      if (/\/product-p\/ss-/.test(p)) return true;
      if (/ss-barron|ss-luna/.test(p)) return true;
      var pc = global.document && global.document.querySelector(
        '#v65-product-parent input[name="ProductCode"], input[name="ProductCode"]'
      );
      var code = String((pc && pc.value) || "").toUpperCase();
      if (/^SS-/.test(code)) return true;
    } catch (eSkip) {}
    return false;
  }

  if (skipHeavyAuthImpl()) {
    try {
      global.document.documentElement.setAttribute("data-mc-pdp-auth-skip-impl", "ss-unfreeze");
    } catch (eAttr) {}
    return;
  }

  try {
    if (global.document && global.document.querySelector('script[src*="mc-pdp-auth-cta-form-impl.js"]')) {
      return;
    }
  } catch (eHas) {}

  var IMPL = "/v/vspfiles/js/mc-pdp-auth-cta-form-impl.js?v=20260725live1&mcrd=once2";
  try {
    var s = global.document.createElement("script");
    s.id = "mc-pdp-auth-cta-form-impl-js";
    s.src = IMPL;
    s.async = false;
    (global.document.head || global.document.documentElement).appendChild(s);
  } catch (eBoot) {}
})(window);
