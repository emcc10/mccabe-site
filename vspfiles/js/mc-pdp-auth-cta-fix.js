/**
 * PDP Sign In / Create Account — modal only, no /login.asp redirect, no room planner on gate clicks.
 * MC_PDP_AUTH_CTA_20260623
 */
(function (global) {
  "use strict";

  var VERSION = "20260623";

  function handleAuthCtaClick(e) {
    if (!e || !e.target || !e.target.closest) return false;

    var loginEl = e.target.closest(
      "[data-mc-open-login], .mc-member-grid-price__login, .mc-configuration-rh__signin-cta, #mcPlannerLoginGate a[href*='login.asp'], #mcPlannerLoginGate a[href*='Login.asp']"
    );
    if (loginEl) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      try {
        e.stopImmediatePropagation();
      } catch (eImm) {}
      if (typeof global.mcOpenLoginModal === "function") {
        global.mcOpenLoginModal();
      } else {
        global.__MC_PDP_PENDING_LOGIN_MODAL__ = true;
      }
      return true;
    }

    var signupEl = e.target.closest(
      "[data-mc-open-signup], #mcPlannerLoginGate a[href*='register.asp'], #mcPlannerLoginGate a[href*='AccountSettings.asp']"
    );
    if (signupEl) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      try {
        e.stopImmediatePropagation();
      } catch (eImm2) {}
      if (typeof global.mcOpenSignupModal === "function") {
        global.mcOpenSignupModal();
      } else {
        global.__MC_PDP_PENDING_SIGNUP_MODAL__ = true;
      }
      return true;
    }

    return false;
  }

  global.mcHandleLoginCtaClick = handleAuthCtaClick;

  if (global.__MC_PDP_AUTH_CTA_FIX_VER__ === VERSION) return;
  global.__MC_PDP_AUTH_CTA_FIX_VER__ = VERSION;

  function isProductPdp() {
    try {
      var b = global.document.body;
      if (b && b.classList.contains("productdetails")) return true;
      if (global.document.getElementById("v65-product-parent")) return true;
    } catch (e) {}
    return false;
  }

  function openLoginModal() {
    if (typeof global.mcOpenLoginModal === "function") {
      global.mcOpenLoginModal();
      return;
    }
    global.__MC_PDP_PENDING_LOGIN_MODAL__ = true;
  }

  function openSignupModal() {
    if (typeof global.mcOpenSignupModal === "function") {
      global.mcOpenSignupModal();
      return;
    }
    global.__MC_PDP_PENDING_SIGNUP_MODAL__ = true;
  }

  function convertLegacyGateLinks(g) {
    if (!g || g.querySelector("button[data-mc-open-login]")) return;
    var legacyLogin = g.querySelector('a[href*="login.asp"], a[href*="Login.asp"]');
    var legacySignup = g.querySelector('a[href*="register.asp"], a[href*="AccountSettings.asp"]');
    if (!legacyLogin && !legacySignup) return;
    var row =
      g.querySelector(".mc-planner-login-gate__actions") ||
      g.querySelector('div[style*="flex"]') ||
      g;
    if (!row) return;
    row.className = "mc-planner-login-gate__actions";
    row.innerHTML =
      '<button type="button" class="mc-config-btn" data-mc-open-login style="display:inline-block;padding:8px 14px;border:1px solid #333;background:#fff;color:#111;font-size:12px;cursor:pointer;">Sign In</button>' +
      '<button type="button" class="mc-config-btn" data-mc-open-signup style="display:inline-block;padding:8px 14px;border:1px solid #333;background:#fff;color:#111;font-size:12px;cursor:pointer;">Create Account</button>';
  }

  function bindGateButtons(g) {
    if (!g) return;
    convertLegacyGateLinks(g);
    if (typeof global.mcBindPlannerGateAuthButtons === "function") {
      global.mcBindPlannerGateAuthButtons(g);
      return;
    }
    var loginBtn = g.querySelector("[data-mc-open-login]");
    var signupBtn = g.querySelector("[data-mc-open-signup]");
    if (loginBtn && !loginBtn.dataset.mcAuthBound) {
      loginBtn.dataset.mcAuthBound = "1";
      loginBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();
        openLoginModal();
        return false;
      };
    }
    if (signupBtn && !signupBtn.dataset.mcAuthBound) {
      signupBtn.dataset.mcAuthBound = "1";
      signupBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();
        openSignupModal();
        return false;
      };
    }
  }

  function wirePlannerLoginGate() {
    var g = global.document.getElementById("mcPlannerLoginGate");
    if (!g) return;
    bindGateButtons(g);
    if (g.dataset.mcGateCapture === "1") return;
    g.dataset.mcGateCapture = "1";
    g.addEventListener(
      "click",
      function (ev) {
        if (
          !ev.target.closest(
            "[data-mc-open-login], [data-mc-open-signup], button, a"
          )
        ) {
          return;
        }
        handleAuthCtaClick(ev);
      },
      true
    );
  }

  function guardConfigurationBlockClick() {
    var block = global.document.getElementById("mcConfigurationBlock");
    if (!block) return;

    var skipSelector =
      "#mcPlannerLoginGate, [data-mc-open-login], [data-mc-open-signup], .mc-configuration-rh__signin-cta, button, a, input, select, textarea, label";

    function shouldOpenPlanner(ev) {
      if (!ev || !ev.target || !ev.target.closest) return false;
      if (ev.target.closest(skipSelector)) return false;
      var cap = global.document.getElementById("mcConfigurationCaption");
      if (cap && cap.classList.contains("mc-configuration-rh__planner-only")) {
        return !!ev.target.closest("#mcConfigurationCaption");
      }
      return true;
    }

    block.onclick = function (ev) {
      if (!shouldOpenPlanner(ev)) return;
      if (typeof global.openPlannerOverlay === "function") {
        global.openPlannerOverlay();
      }
    };
    block.dataset.mcAuthPlannerGuard = "1";
  }

  function patchCaptionSignInCta() {
    var cap = global.document.getElementById("mcConfigurationCaption");
    if (!cap) return;
    var t = (cap.textContent || "").replace(/\s+/g, " ").trim();
    if (!/^sign in for configured price\.?$/i.test(t)) return;
    if (cap.querySelector("[data-mc-open-login]")) return;
    cap.innerHTML =
      '<button type="button" class="mc-configuration-rh__signin-cta" data-mc-open-login style="border:none;background:none;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer;">Sign in</button> for configured price.';
  }

  function runPatch() {
    if (!isProductPdp()) return;
    wirePlannerLoginGate();
    guardConfigurationBlockClick();
    patchCaptionSignInCta();
  }

  if (!global.__MC_PDP_AUTH_CTA_CAPTURE__) {
    global.__MC_PDP_AUTH_CTA_CAPTURE__ = true;
    global.document.addEventListener(
      "click",
      function (e) {
        if (handleAuthCtaClick(e)) return;
        if (typeof global.mcHandleLoginCtaClick === "function") {
          global.mcHandleLoginCtaClick(e);
        }
      },
      true
    );
  }

  global.addEventListener("load", function () {
    if (global.__MC_PDP_PENDING_LOGIN_MODAL__ && typeof global.mcOpenLoginModal === "function") {
      global.__MC_PDP_PENDING_LOGIN_MODAL__ = false;
      global.mcOpenLoginModal();
    }
    if (global.__MC_PDP_PENDING_SIGNUP_MODAL__ && typeof global.mcOpenSignupModal === "function") {
      global.__MC_PDP_PENDING_SIGNUP_MODAL__ = false;
      global.mcOpenSignupModal();
    }
  });

  runPatch();
  global.document.addEventListener("DOMContentLoaded", runPatch);
  global.addEventListener("load", runPatch);
  [0, 50, 200, 600, 1500, 4000, 9000].forEach(function (ms) {
    global.setTimeout(runPatch, ms);
  });

  if (typeof MutationObserver !== "undefined") {
    var scheduled = false;
    var mo = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      global.requestAnimationFrame(function () {
        scheduled = false;
        runPatch();
      });
    });
    var root = global.document.getElementById("mcConfigurationBlock") || global.document.body;
    if (root) mo.observe(root, { childList: true, subtree: true });
  }
})(window);
