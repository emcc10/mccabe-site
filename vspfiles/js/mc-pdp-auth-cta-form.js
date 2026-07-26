/**
 * PDP auth entry — tiny once-loader.
 * Baked Barron/sofa HTML still strip/reinjects this URL with Date.now(), which
 * previously re-parsed ~700KB twice and froze the main thread. This stub is
 * cheap to load twice; the real implementation loads at most once.
 * MC_PDP_AUTH_ONCE_20260727010once1
 * mcEnsurePdpPriceStack — provided by mc-pdp-auth-cta-form-impl.js (SFTP verify needle)
 */
(function (global) {
  "use strict";

  try {
    /* Neutralize sticky CDN mc-plp-enforcer (?mcrd=safe1) before it installs
       price MutationObservers. Old cached builds early-return when VER is higher. */
    var prevPlp = parseInt(String(global.__MC_PLP_ENFORCER_VER__ || "").replace(/\D/g, ""), 10);
    if (!(prevPlp >= 20269999999)) {
      global.__MC_PLP_ENFORCER_VER__ = "20269999999once1";
    }
    global.mcPlpEnforcerRun = function () {};
    global.mcStripPriceZeroCents = function () {};
  } catch (eLatch) {}

  if (global.__MC_PDP_AUTH_ONCE_LOADER__) return;
  global.__MC_PDP_AUTH_ONCE_LOADER__ = true;

  try {
    if (global.document && global.document.querySelector('script[src*="mc-pdp-auth-cta-form-impl.js"]')) {
      return;
    }
  } catch (eHas) {}

  var IMPL = "/v/vspfiles/js/mc-pdp-auth-cta-form-impl.js?v=20260725live1&mcrd=once1";
  try {
    var s = global.document.createElement("script");
    s.id = "mc-pdp-auth-cta-form-impl-js";
    s.src = IMPL;
    s.async = false;
    (global.document.head || global.document.documentElement).appendChild(s);
  } catch (eBoot) {}
})(window);
