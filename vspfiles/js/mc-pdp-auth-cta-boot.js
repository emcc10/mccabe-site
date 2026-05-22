/**
 * PDP: force-load mc-pdp-auth-cta-fix.js (bypasses stale ?v=20260624 browser cache on baked pages).
 * MC_PDP_AUTH_CTA_BOOT_20260527
 */
(function (g, d) {
  "use strict";
  var WANT = "20260523boot";

  function onPdp() {
    try {
      return (
        (d.body && d.body.classList.contains("productdetails")) ||
        !!d.getElementById("v65-product-parent")
      );
    } catch (e) {
      return false;
    }
  }

  function ensure() {
    try {
      if (!onPdp()) return;
      if (String(g.__MC_PDP_AUTH_CTA_FIX_VER__ || "") === WANT) return;
      d.querySelectorAll('script[src*="mc-pdp-auth-cta-fix.js"]').forEach(function (old) {
        try {
          old.remove();
        } catch (eRm) {}
      });
      delete g.__MC_PDP_AUTH_CTA_FIX_VER__;
      var s = d.createElement("script");
      s.id = "mc-pdp-auth-cta-boot-injected";
      s.src = "/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v=" + WANT + "&mcrd=" + Date.now();
      s.async = false;
      (d.head || d.documentElement).appendChild(s);
    } catch (eLoad) {}
  }

  ensure();
  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", ensure);
  }
  g.addEventListener("load", ensure);
  [0, 200, 600, 1500, 4000].forEach(function (ms) {
    g.setTimeout(ensure, ms);
  });
})(window, document);
