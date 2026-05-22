/**
 * PDP Sign In / Create Account — modal only, no /login.asp redirect, no room planner on gate clicks.
 * Post-login: close modal first, refresh member/planner pricing in background (works without template rebake).
 * MC_PDP_AUTH_CTA_20260624 — price stack repair MC_PDP_PRICE_STACK_20260522 (no template rebake)
 */
(function (global) {
  "use strict";

  var VERSION = "20260523boot";
  /* Set immediately so console/deploy checks work even if later init throws */
  global.__MC_PDP_AUTH_CTA_FIX_VER__ = VERSION;

  function authDelay(ms) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function loginReturnTo() {
    return encodeURIComponent(
      (global.location.pathname || "/") + (global.location.search || "")
    );
  }

  function normalizeLoginFields(form) {
    if (!form) return;
    var emailEl = global.document.getElementById("mc-login-email");
    if (emailEl) emailEl.setAttribute("name", "email");
    var passwordEl = global.document.getElementById("mc-login-password");
    if (passwordEl) passwordEl.setAttribute("name", "password");
  }

  function getAuthFrame() {
    var frame = global.document.getElementById("mc-member-auth-frame");
    if (frame) return frame;
    frame = global.document.createElement("iframe");
    frame.id = "mc-member-auth-frame";
    frame.name = "mc-member-auth-frame";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.style.cssText =
      "position:absolute;left:-9999px;width:1px;height:1px;border:0";
    try {
      global.document.body.appendChild(frame);
    } catch (e) {}
    return frame;
  }

  function readAuthFrameSnapshot() {
    var frame = global.document.getElementById("mc-member-auth-frame");
    if (!frame) return { html: "", url: "" };
    try {
      var win = frame.contentWindow;
      var doc = frame.contentDocument || (win && win.document);
      var url = win && win.location ? String(win.location.href || "") : "";
      var html = doc && doc.documentElement ? doc.documentElement.innerHTML : "";
      return { html: html, url: url };
    } catch (eFrame) {
      return { html: "", url: "" };
    }
  }

  function domIndicatesLoggedIn() {
    try {
      if (
        global.document.body &&
        global.document.body.classList.contains("mc-member-logged-in")
      ) {
        return true;
      }
      if (
        global.document.querySelector(
          'a[href*="logout.asp"], a[href*="logoff.asp"]'
        )
      ) {
        return true;
      }
    } catch (eDom) {}
    return false;
  }

  function volusionAuthSuccess(html, url) {
    var check =
      global.volusionMyAccountHtmlIndicatesLoggedIn ||
      (typeof volusionMyAccountHtmlIndicatesLoggedIn === "function"
        ? volusionMyAccountHtmlIndicatesLoggedIn
        : null);
    if (typeof check === "function" && check(html)) return true;
    var u = String(url || "").toLowerCase();
    if (/productdetails\.asp/i.test(u)) return true;
    if (
      /\/\w+-p\//.test(u) &&
      u.indexOf("login.asp") === -1 &&
      u.indexOf("customer_login") === -1
    ) {
      return true;
    }
    return domIndicatesLoggedIn();
  }

  function loginResponseFailed(html, respUrl) {
    var raw = String(html || "");
    var stripped = raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
    var lc = stripped.toLowerCase();
    var url = String(respUrl || "").toLowerCase();
    if (
      /the email address or password[^<]*invalid|invalid (?:email|login|password)|login failed|not recognized|could not log you in/i.test(
        lc
      )
    ) {
      return true;
    }
    if (
      typeof global.volusionMyAccountHtmlIndicatesLoggedIn === "function" &&
      global.volusionMyAccountHtmlIndicatesLoggedIn(raw)
    ) {
      return false;
    }
    if (/href\s*=\s*["'][^"']*logout\.asp[^"']*["']/i.test(stripped)) {
      return false;
    }
    if (url.indexOf("/customer_login.asp") !== -1) return true;
    if (
      url.indexOf("/login.asp") !== -1 &&
      /<input[^>]+name\s*=\s*["']password["']/i.test(stripped)
    ) {
      return true;
    }
    return false;
  }

  function postHiddenVolusionForm(actionUrl, fields) {
    return new Promise(function (resolve, reject) {
      var frame = getAuthFrame();
      var settled = false;
      var timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        try {
          frame.onload = null;
        } catch (eT) {}
        reject(new Error("timeout"));
      }, 22000);
      frame.onload = function () {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        try {
          frame.onload = null;
        } catch (eL) {}
        global.setTimeout(function () {
          resolve(readAuthFrameSnapshot());
        }, 280);
      };
      var f = global.document.createElement("form");
      f.method = "POST";
      f.action = actionUrl;
      f.target = frame.name;
      f.style.cssText = "position:absolute;left:-9999px;visibility:hidden";
      Object.keys(fields || {}).forEach(function (key) {
        var inp = global.document.createElement("input");
        inp.type = "hidden";
        inp.name = key;
        inp.value = fields[key] == null ? "" : String(fields[key]);
        f.appendChild(inp);
      });
      global.document.body.appendChild(f);
      try {
        f.submit();
      } catch (eSub) {
        settled = true;
        global.clearTimeout(timer);
        reject(eSub);
        return;
      }
      global.setTimeout(function () {
        try {
          f.remove();
        } catch (eRm) {}
      }, 600);
    });
  }

  function fetchVolusionAuth(url, body) {
    return global.fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html,application/xhtml+xml",
      },
      body: body,
      redirect: "follow",
    });
  }

  async function authSucceeded() {
    if (domIndicatesLoggedIn()) return true;
    try {
      var ctrl =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = null;
      if (ctrl) {
        timer = global.setTimeout(function () {
          try {
            ctrl.abort();
          } catch (eA) {}
        }, 4500);
      }
      var resp = await global.fetch(
        "/myaccount.asp?mcAuthCheck=" + Date.now(),
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: ctrl ? ctrl.signal : undefined,
        }
      );
      var html = await resp.text();
      if (timer) global.clearTimeout(timer);
      var check = global.volusionMyAccountHtmlIndicatesLoggedIn;
      if (typeof check === "function") return !!check(html);
    } catch (e2) {}
    return false;
  }

  async function waitForAuthSuccess(maxMs, intervalMs) {
    var timeoutMs = Math.max(1000, Number(maxMs) || 0);
    var stepMs = Math.max(200, Number(intervalMs) || 0);
    var started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        if (await authSucceeded()) return true;
      } catch (ePoll) {}
      await authDelay(stepMs);
    }
    return false;
  }

  async function postVolusionLoginTwoStep(form) {
    normalizeLoginFields(form);
    var emailEl = global.document.getElementById("mc-login-email");
    var passwordEl = global.document.getElementById("mc-login-password");
    var email = emailEl ? String(emailEl.value || "").trim() : "";
    var password = passwordEl ? String(passwordEl.value || "") : "";
    if (!email || !password) return false;

    var returnTo = loginReturnTo();
    var step1 = "/login.asp?ReturnTo=" + returnTo;
    var step2 = "/login.asp?ReturnTo=" + returnTo;

    try {
      await postHiddenVolusionForm(step1, {
        CustomerNewOld: "old",
        email: email,
        "imageField2.x": "1",
        "imageField2.y": "1",
      });
      await authDelay(400);
      var afterStep2 = await postHiddenVolusionForm(step2, {
        CustomerNewOld: "old",
        email: email,
        password: password,
        "imageField2.x": "1",
        "imageField2.y": "1",
      });
      if (
        volusionAuthSuccess(
          afterStep2 && afterStep2.html,
          afterStep2 && afterStep2.url
        )
      ) {
        return true;
      }
      if (
        loginResponseFailed(
          afterStep2 && afterStep2.html,
          afterStep2 && afterStep2.url
        )
      ) {
        return false;
      }
    } catch (eLoginSteps) {
      try {
        var body1 =
          "CustomerNewOld=old&email=" +
          encodeURIComponent(email) +
          "&imageField2.x=1&imageField2.y=1";
        await fetchVolusionAuth(step1, body1);
        await authDelay(300);
        var body2 =
          "CustomerNewOld=old&email=" +
          encodeURIComponent(email) +
          "&password=" +
          encodeURIComponent(password) +
          "&imageField2.x=1&imageField2.y=1";
        var r2 = await fetchVolusionAuth(step2, body2);
        var html2 = await r2.text();
        if (volusionAuthSuccess(html2, r2.url)) return true;
        if (loginResponseFailed(html2, r2.url)) return false;
      } catch (eFetch) {
        return false;
      }
    }
    if (await authSucceeded()) return true;
    return waitForAuthSuccess(10000, 400);
  }

  function closeLoginModalOnly() {
    if (typeof global.mcCloseLoginModalOnly === "function") {
      global.mcCloseLoginModalOnly();
      return;
    }
    var m = global.document.getElementById("mc-login-modal");
    if (!m) return;
    m.classList.remove("mc-login-modal--open");
    m.setAttribute("aria-hidden", "true");
    try {
      m.style.removeProperty("display");
      m.style.removeProperty("visibility");
      m.style.removeProperty("opacity");
      m.style.removeProperty("pointer-events");
      m.style.removeProperty("z-index");
      global.document.body.style.overflow = "";
    } catch (e2) {}
  }

  function refreshMemberPricingAfterAuth() {
    if (typeof global.mcRefreshMemberPricingAfterAuth === "function") {
      return global.mcRefreshMemberPricingAfterAuth();
    }
    return Promise.resolve()
      .then(function () {
        try {
          if (typeof global.mcRememberRecentMemberAuth === "function") {
            global.mcRememberRecentMemberAuth();
          }
        } catch (eRem) {}
        try {
          global.__mcMemberPricing.promise = null;
        } catch (ePr) {}
        try {
          global.document.body.classList.add("mc-member-logged-in");
        } catch (eCls) {}
        if (typeof global.detectMemberPricingState === "function") {
          return global.detectMemberPricingState();
        }
      })
      .then(function () {
        try {
          if (typeof global.refreshPlannerPriceForMemberState === "function") {
            global.refreshPlannerPriceForMemberState();
          }
        } catch (eRpf) {}
        try {
          if (typeof global.renderMemberPricingCaption === "function") {
            global.renderMemberPricingCaption(global.document);
          }
        } catch (eCap) {}
        try {
          if (typeof global.forceProductFixes === "function") {
            global.forceProductFixes();
          }
        } catch (eFx) {}
        try {
          if (typeof global.mcRenderRetailMemberOnPdp === "function") {
            return global.mcRenderRetailMemberOnPdp();
          }
        } catch (ePdp) {}
      })
      .then(function () {
        try {
          mcEnsurePdpPriceStack();
        } catch (eStack) {}
      });
  }

  function mcFinishLoginModalAndRefreshPdp() {
    closeLoginModalOnly();
    try {
      global.document.body.style.overflow = "";
    } catch (eOv) {}
    global.setTimeout(function () {
      var p = refreshMemberPricingAfterAuth();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          try {
            if (typeof global.detectMemberPricingState === "function") {
              global.__mcMemberPricing.promise = null;
              global.detectMemberPricingState();
            }
          } catch (eRetry) {}
        });
      }
    }, 0);
  }

  global.mcFinishLoginModalAndRefreshPdp = mcFinishLoginModalAndRefreshPdp;

  function templateSubmitHasFinish() {
    var fn = global.mcSubmitAuthForm;
    if (!fn) return false;
    try {
      return String(fn).indexOf("mcFinishLoginModalAndRefreshPdp") !== -1;
    } catch (e) {}
    return false;
  }

  function installAuthSubmitOverride() {
    if (templateSubmitHasFinish()) return;
    if (
      global.mcSubmitAuthForm &&
      global.mcSubmitAuthForm.__mcAuthCtaOverrideVer === VERSION
    ) {
      return;
    }
    var prev = global.mcSubmitAuthForm;

    global.mcSubmitAuthForm = async function (form, mode) {
      if (mode !== "login") {
        if (prev) return prev.call(this, form, mode);
        return false;
      }
      try {
        if (typeof global.mcSetAuthStatus === "function") {
          global.mcSetAuthStatus(mode, "", "");
        }
        if (typeof global.mcToggleAuthPending === "function") {
          global.mcToggleAuthPending(form, true);
        }
        if (typeof global.mcSetAuthStatus === "function") {
          global.mcSetAuthStatus(mode, "Signing in.", "success");
        }
      } catch (eUi) {}

      var ok = await postVolusionLoginTwoStep(form);

      try {
        if (typeof global.mcToggleAuthPending === "function") {
          global.mcToggleAuthPending(form, false);
        }
      } catch (eUi2) {}

      if (ok) {
        try {
          if (typeof global.mcLoginModalRememberRecentAuth === "function") {
            global.mcLoginModalRememberRecentAuth();
          }
        } catch (eRem) {}
        try {
          if (typeof global.mcSetAuthStatus === "function") {
            global.mcSetAuthStatus(mode, "Signed in.", "success");
          }
        } catch (eStat) {}
        mcFinishLoginModalAndRefreshPdp();
        return true;
      }

      try {
        if (typeof global.mcLoginModalClearRecentAuth === "function") {
          global.mcLoginModalClearRecentAuth();
        }
        if (typeof global.mcSetAuthStatus === "function") {
          global.mcSetAuthStatus(
            mode,
            'Sign-in failed. Check your email and password, or use "Open in a new tab" below.',
            "error"
          );
        }
      } catch (eFail) {}
      return false;
    };
    global.mcSubmitAuthForm.__mcAuthCtaOverrideVer = VERSION;
  }

  [0, 50, 200, 600, 1500, 4000, 9000].forEach(function (ms) {
    global.setTimeout(installAuthSubmitOverride, ms);
  });

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

  global.__MC_PDP_AUTH_CTA_FIX_VER__ = VERSION;
  global.mcPdpAuthCtaRefresh = function () {
    try {
      runPatch();
    } catch (eRef) {}
  };

  function isProductPdp() {
    try {
      var b = global.document.body;
      if (b && b.classList.contains("productdetails")) return true;
      if (global.document.getElementById("v65-product-parent")) return true;
      var p = String(global.location.pathname || "").toLowerCase();
      if (/\.htm(?:\?|$)/i.test(p) && global.document.querySelector(".colors_pricebox")) return true;
    } catch (e) {}
    return false;
  }

  function parseMoney(text) {
    if (typeof global.parseMcCurrency === "function") {
      return Number(global.parseMcCurrency(text == null ? "" : String(text))) || 0;
    }
    var m = String(text == null ? "" : text).match(/\$[\d,]+(?:\.\d+)?/);
    if (!m) return 0;
    return parseFloat(m[0].replace(/[$,]/g, "")) || 0;
  }

  function fmtMoney(n) {
    n = Number(n || 0);
    if (!(n > 0)) return "";
    if (typeof global.mcFmtMoney === "function") return global.mcFmtMoney(n);
    return (
      "$" +
      n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }

  function readRetailAmountForSale() {
    var el =
      global.document.querySelector(".mc-pdp-retail-row .product_list_price") ||
      global.document.querySelector(".mc-pdp-retail-row font.product_list_price") ||
      global.document.querySelector("#v65-product-parent .product_list_price") ||
      global.document.querySelector("#content_area .product_list_price");
    return el ? parseMoney(el.textContent || "") : 0;
  }

  function readSaleFromVisibleNodes() {
    var nodes = global.document.querySelectorAll(
      "#v65-product-parent .colors_pricebox .product_sale_price, #v65-product-parent .colors_pricebox .product_saleprice, " +
        "#v65-product-parent .colors_pricebox font.product_sale_price, #v65-product-parent .mtl-product-price-block .product_sale_price, " +
        "#v65-product-parent .mtl-product-price-block .product_saleprice"
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      var amt = parseMoney(nodes[i].textContent || "");
      if (amt > 0) return amt;
    }
    return 0;
  }

  function readSaleFromPriceBox() {
    var box =
      global.document.querySelector("#v65-product-parent .colors_pricebox") ||
      global.document.querySelector("#content_area .colors_pricebox");
    if (!box) return 0;
    var text = box.textContent || "";
    var amounts = [];
    var re = /\$[\d,]+(?:\.\d{2})?/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var v = parseMoney(m[0]);
      if (v > 0) amounts.push(v);
    }
    if (amounts.length < 2) return 0;
    amounts.sort(function (a, b) {
      return b - a;
    });
    var retail = amounts[0];
    var sale = amounts[amounts.length - 1];
    if (sale > 0 && sale < retail) return sale;
    if (amounts.length >= 2 && amounts[1] < retail) return amounts[1];
    return 0;
  }

  function resolvePdpSaleAmount() {
    if (global.__mcPdpSaleAmtCached > 0) return global.__mcPdpSaleAmtCached;
    var amt = readSaleFromVisibleNodes();
    if (!(amt > 0)) amt = readSaleFromPriceBox();
    if (!(amt > 0)) {
      var inputs = global.document.querySelectorAll(
        "#v65-product-parent input, #v65-product-parent textarea, #content_area input, #content_area textarea"
      );
      var i;
      for (i = 0; i < inputs.length; i++) {
        var nm = ((inputs[i].name || "") + " " + (inputs[i].id || ""))
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        if (nm.indexOf("saleprice") === -1) continue;
        amt = parseMoney(inputs[i].value || inputs[i].getAttribute("value") || "");
        if (amt > 0) break;
      }
    }
    if (!(amt > 0) && typeof global.getVolusionAddToCartSeatPrice === "function") {
      amt = Number(global.getVolusionAddToCartSeatPrice(global.document)) || 0;
    }
    if (!(amt > 0) && typeof global.tryReadHowToGetSalePrice === "function") {
      amt = Number(global.tryReadHowToGetSalePrice(readRetailAmountForSale(), true)) || 0;
    }
    if (!(amt > 0)) {
      try {
        if (typeof global.HowToGetSalePrice === "function") {
          amt = Number(global.HowToGetSalePrice(readRetailAmountForSale())) || 0;
        } else if (Number(global.SalePrice) > 0) {
          amt = Number(global.SalePrice);
        }
      } catch (eW) {}
    }
    if (!(amt > 0)) {
      try {
        if (global.__mcMemberPricing && global.__mcMemberPricing.memberSeatPrice > 0) {
          amt = Number(global.__mcMemberPricing.memberSeatPrice) || 0;
        } else if (Number(global.__MC_MEMBER_SEAT_PRICE) > 0) {
          amt = Number(global.__MC_MEMBER_SEAT_PRICE);
        }
      } catch (eMp) {}
    }
    if (!(amt > 0) && typeof global.mcReadCurrentVisibleMemberUnitPrice === "function") {
      amt = Number(global.mcReadCurrentVisibleMemberUnitPrice()) || 0;
    }
    if (!(amt > 0)) {
      var html = "";
      try {
        html = global.document.documentElement.innerHTML || "";
      } catch (eH) {}
      var patterns = [
        /\bSalePrice\s*[=:]\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
        /\bwindow\.SalePrice\s*=\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
        /["']SalePrice["']\s*:\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
      ];
      var pi;
      for (pi = 0; pi < patterns.length; pi++) {
        var r = patterns[pi];
        var m;
        r.lastIndex = 0;
        while ((m = r.exec(html)) !== null) {
          var p = parseMoney(m[1]);
          if (p > 0 && p < 50000000) {
            amt = p;
            break;
          }
        }
        if (amt > 0) break;
      }
    }
    if (amt > 0) global.__mcPdpSaleAmtCached = amt;
    return amt;
  }

  function hasMcPdpStackMarkers() {
    return !!global.document.querySelector(
      ".mc-pdp-member-pricing, .mc-pdp-retail-row, #v65-product-parent .mc-pdp-member-line, #content_area .mc-pdp-member-line"
    );
  }

  function ensurePdpStackCriticalCss() {
    if (global.document.getElementById("mc-pdp-stack-critical-css")) return;
    var el = global.document.createElement("style");
    el.id = "mc-pdp-stack-critical-css";
    el.textContent =
      "body.productdetails:has(.mc-pdp-retail-row):has(.mc-pdp-member-line) #v65-product-parent .colors_pricebox .product_saleprice," +
      "body.mc-product-page:has(.mc-pdp-retail-row):has(.mc-pdp-member-line) #v65-product-parent .colors_pricebox .product_saleprice," +
      "body.productdetails:has(.mc-pdp-retail-row):has(.mc-pdp-member-pricing) #v65-product-parent .colors_pricebox .product_sale_price," +
      "body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent .colors_pricebox .product_productprice," +
      "body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent .colors_pricebox font.colors_text:has(.product_productprice)," +
      "body.productdetails:has(.mc-pdp-retail-row):has(.mc-pdp-member-line) #v65-product-parent .colors_pricebox b:has(.product_saleprice)," +
      "body.productdetails:has(.mc-pdp-retail-row):has(.mc-pdp-member-line) #v65-product-parent .colors_pricebox font.pricecolor:has(.product_saleprice)" +
      "{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}" +
      "body.productdetails .mc-pdp-retail-row,body.productdetails .mc-pdp-member-pricing,body.productdetails .mc-pdp-member-line," +
      "body.productdetails #mcConfigurationBlock #mcConfigurationPrice,body.productdetails #mcConfigurationBlock .mc-configuration-rh__addl," +
      "body.productdetails #mcConfigurationBlock .mc-configuration-rh__total-line,body.productdetails #mcConfigurationBlock .mc-configuration-rh__pieces" +
      "{display:block!important;visibility:visible!important;opacity:1!important;height:auto!important;max-height:none!important}" +
      "body.productdetails .mc-pdp-member-pricing .product_saleprice,body.productdetails .mc-pdp-member-pricing .product_sale_price," +
      "body.productdetails .mc-pdp-member-pricing font.product_sale_price,body.productdetails .mc-pdp-member-pricing .mc-member-price-caption" +
      "{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;opacity:0!important}";
    (global.document.head || global.document.documentElement).appendChild(el);
  }

  function ensureMemberPricingWrap() {
    var wrap = global.document.querySelector(".mc-pdp-member-pricing");
    if (wrap) return wrap;
    var root =
      global.document.getElementById("v65-product-parent") ||
      global.document.getElementById("content_area");
    if (!root) return null;
    var lines = root.querySelectorAll(".mc-pdp-member-line");
    if (!lines.length) return null;
    wrap = global.document.createElement("div");
    wrap.className = "mc-pdp-member-pricing";
    var first = lines[0];
    if (!first || !first.parentNode) return null;
    first.parentNode.insertBefore(wrap, first);
    var i;
    for (i = 0; i < lines.length; i++) {
      if (lines[i].parentNode !== wrap) wrap.appendChild(lines[i]);
    }
    return wrap;
  }

  function hideMainPriceboxNativeSale() {
    if (!global.document.querySelector(".mc-pdp-retail-row")) return;
    var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (!box || !box.querySelectorAll) return;
    box.querySelectorAll(".product_saleprice, .product_sale_price, font.product_sale_price").forEach(function (node) {
      if (!node || (node.closest && node.closest(".mc-pdp-member-line--sale"))) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
        node.style.setProperty("pointer-events", "none", "important");
      } catch (eBox) {}
    });
    box.querySelectorAll("b, font.pricecolor, font.colors_productprice").forEach(function (wrapEl) {
      if (!wrapEl || (wrapEl.closest && wrapEl.closest(".mc-pdp-member-line"))) return;
      if (
        wrapEl.querySelector(".product_saleprice, .product_sale_price") &&
        !wrapEl.querySelector(".mc-pdp-member-line")
      ) {
        try {
          wrapEl.style.setProperty("display", "none", "important");
          wrapEl.style.setProperty("visibility", "hidden", "important");
          wrapEl.style.setProperty("height", "0", "important");
          wrapEl.style.setProperty("overflow", "hidden", "important");
          wrapEl.style.setProperty("opacity", "0", "important");
        } catch (eWrap) {}
      }
    });
    if (global.document.querySelector(".mc-pdp-retail-row")) {
      box.querySelectorAll(".product_productprice").forEach(function (node) {
        if (!node || (node.closest && node.closest(".mc-pdp-retail-row"))) return;
        try {
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("height", "0", "important");
          node.style.setProperty("opacity", "0", "important");
        } catch (ePp) {}
      });
      box.querySelectorAll("font.text.colors_text, font.colors_text").forEach(function (fontEl) {
        if (!fontEl || (fontEl.closest && fontEl.closest(".mc-pdp-retail-row, .mc-pdp-member-line"))) return;
        if (fontEl.querySelector(".product_productprice")) {
          try {
            fontEl.style.setProperty("display", "none", "important");
            fontEl.style.setProperty("visibility", "hidden", "important");
            fontEl.style.setProperty("height", "0", "important");
            fontEl.style.setProperty("overflow", "hidden", "important");
            fontEl.style.setProperty("opacity", "0", "important");
          } catch (eFont) {}
        }
      });
    }
  }

  function ensureMcCabeRetailStack() {
    if (!isProductPdp()) return;
    if (
      !global.document.querySelector(".mc-pdp-retail-row") &&
      typeof global.mcRenderRetailMemberOnPdp === "function"
    ) {
      try {
        global.mcRenderRetailMemberOnPdp();
      } catch (eRender) {}
    }
    global.document
      .querySelectorAll(
        ".mc-pdp-retail-row, .mc-pdp-member-pricing, .mc-pdp-member-line, .mc-pdp-retail-label"
      )
      .forEach(function (node) {
        if (!node || !node.style) return;
        try {
          node.style.removeProperty("display");
          node.style.setProperty("visibility", "visible", "important");
          node.style.setProperty("opacity", "1", "important");
          node.style.setProperty("height", "auto", "important");
          node.style.setProperty("max-height", "none", "important");
        } catch (eVis) {}
      });
  }

  function extractAdditionalFromOptionText(text) {
    var t = String(text || "");
    var m =
      t.match(/\[\s*Additional\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\]/i) ||
      t.match(/additional\s*\$?\s*([\d,]+(?:\.\d{2})?)/i) ||
      t.match(/\(\s*\+\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\)/i);
    return m ? parseMoney(m[1]) : 0;
  }

  function findConfigurationSelects() {
    if (typeof global.mcFindConfigurationOptionSelects === "function") {
      try {
        return global.mcFindConfigurationOptionSelects(global.document);
      } catch (eF) {}
    }
    var configSel = null;
    var seatsSel = null;
    global.document.querySelectorAll("#options_table select, #v65-product-parent select").forEach(function (sel) {
      if (sel.classList && sel.classList.contains("mc-native-leather")) return;
      var txt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
      if (!configSel && /additional|sectional configuration|\d+\/\d+/i.test(String(txt))) configSel = sel;
      if (!seatsSel && /seat|straight|curved/i.test(String(txt))) seatsSel = sel;
    });
    return { configSel: configSel, seatsSel: seatsSel };
  }

  function inlineSyncConfigurationPrice() {
    var capEl = global.document.getElementById("mcConfigurationCaption");
    var pieEl = global.document.getElementById("mcConfigurationPieces");
    var priceEl = global.document.getElementById("mcConfigurationPrice");
    if (!pieEl || !priceEl) return;
    var picks = findConfigurationSelects();
    var configSel = picks.configSel;
    if (!configSel) {
      if (priceEl) {
        priceEl.style.display = "none";
        priceEl.textContent = "";
      }
      return;
    }
    var additional = 0;
    if (configSel.selectedIndex >= 0) {
      additional = extractAdditionalFromOptionText(
        configSel.options[configSel.selectedIndex].text || configSel.options[configSel.selectedIndex].innerText
      );
    }
    var loggedIn = false;
    try {
      loggedIn =
        !!(global.document.body && global.document.body.classList.contains("mc-member-logged-in")) ||
        !!global.sessionStorage.getItem("mc_recent_member_auth");
    } catch (eLi) {}
    var priceHtml = [];
    if (additional > 0) {
      priceHtml.push(
        '<div class="mc-configuration-rh__addl">Additional configuration cost: ' +
          fmtMoney(additional) +
          "</div>"
      );
    }
    if (loggedIn) {
      var totalAmt = 0;
      var pwo =
        global.document.getElementById("priceWithOptions") ||
        global.document.getElementById("priceWithOptionsNoTax");
      if (pwo) {
        totalAmt =
          parseMoney(
            (pwo.getAttribute && (pwo.getAttribute("value") || pwo.getAttribute("content"))) ||
              pwo.textContent ||
              ""
          ) || 0;
      }
      if (!(totalAmt > 0) && typeof global.getVolusionAddToCartSeatPrice === "function") {
        totalAmt = Number(global.getVolusionAddToCartSeatPrice(global.document)) || 0;
      }
      if (!(totalAmt > 0) && additional > 0) {
        var retailEl = global.document.querySelector(".mc-pdp-retail-row .product_list_price");
        var baseAmt = retailEl ? parseMoney(retailEl.textContent || "") : 0;
        if (!(baseAmt > 0)) baseAmt = resolvePdpSaleAmount() || readRetailAmountForSale();
        if (baseAmt > 0) totalAmt = baseAmt + additional;
      }
      if (totalAmt > 0) {
        priceHtml.push('<div class="mc-configuration-rh__total-line">Total: ' + fmtMoney(totalAmt) + "</div>");
      }
    }
    if (priceHtml.length) {
      priceEl.innerHTML = priceHtml.join("");
      priceEl.style.display = "block";
    } else {
      priceEl.style.display = "none";
      priceEl.textContent = "";
    }
    if (capEl && additional > 0 && !loggedIn) {
      capEl.style.display = "block";
      if (!capEl.querySelector("[data-mc-open-login]")) {
        capEl.innerHTML =
          '<button type="button" class="mc-configuration-rh__signin-cta" data-mc-open-login style="border:none;background:none;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer;">Sign in</button> for configured total.';
      }
    }
  }

  function syncConfigurationBlockPricing() {
    inlineSyncConfigurationPrice();
    if (typeof global.mcSyncConfigurationFromDom === "function") {
      try {
        global.mcSyncConfigurationFromDom();
      } catch (eSync) {}
    }
    if (typeof global.scheduleConfigurationFromDomRetries === "function") {
      try {
        global.scheduleConfigurationFromDomRetries();
      } catch (eSch) {}
    }
  }

  function findRetailStackHost() {
    var optTd = global.document.querySelector("#v65-product-parent td.mc-pdp-options-td");
    if (optTd) {
      var optBox = optTd.querySelector(".colors_pricebox");
      if (optBox) return optBox.querySelector("td") || optBox;
      return optTd;
    }
    var boxes = global.document.querySelectorAll("#v65-product-parent .colors_pricebox");
    if (boxes.length > 1) {
      var second = boxes[boxes.length - 1];
      return second.querySelector("td") || second;
    }
    var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (!box) return null;
    return box.querySelector("td") || box;
  }

  function hideDuplicatePdpPriceUi() {
    try {
      global.document.querySelectorAll(".mc-member-price-caption").forEach(function (cap) {
        if (!cap || !cap.style) return;
        cap.style.setProperty("display", "none", "important");
        cap.style.setProperty("visibility", "hidden", "important");
        cap.style.setProperty("height", "0", "important");
        cap.style.setProperty("overflow", "hidden", "important");
        cap.style.setProperty("opacity", "0", "important");
      });
      var sumPrice = global.document.getElementById("mtl-sum-price");
      if (sumPrice && global.document.querySelector(".mc-pdp-retail-row")) {
        var priceRow = sumPrice.closest && sumPrice.closest(".mtl-summary-row");
        if (priceRow && priceRow.style) {
          priceRow.style.setProperty("display", "none", "important");
        }
      }
      var wrap = global.document.querySelector(".mc-pdp-member-pricing");
      if (wrap) {
        var sales = wrap.querySelectorAll(".mc-pdp-member-line--sale");
        var si;
        for (si = 1; si < sales.length; si++) {
          try {
            sales[si].remove();
          } catch (eRmSale) {}
        }
      }
      global.document
        .querySelectorAll(
          "#v65-product-parent .colors_pricebox > .mc-pdp-member-line, #v65-product-parent .colors_pricebox > font.product_sale_price"
        )
        .forEach(function (node) {
          if (node.closest && node.closest(".mc-pdp-member-pricing, .mc-pdp-retail-row")) return;
          try {
            node.style.setProperty("display", "none", "important");
            node.style.setProperty("visibility", "hidden", "important");
          } catch (eLoose) {}
        });
    } catch (eHideDup) {}
  }

  function relocateRetailStackToOptionsColumn() {
    var retailRow = global.document.querySelector(".mc-pdp-retail-row");
    if (!retailRow) return;
    var host = findRetailStackHost();
    if (!host || host.contains(retailRow)) return;
    try {
      host.insertBefore(retailRow, host.firstChild || null);
    } catch (eRel) {}
    var wrap = global.document.querySelector(".mc-pdp-member-pricing");
    if (wrap && host && !host.contains(wrap)) {
      try {
        if (retailRow.nextSibling) host.insertBefore(wrap, retailRow.nextSibling);
        else host.appendChild(wrap);
      } catch (eWrap) {}
    }
  }

  function buildMinimalRetailMemberStack() {
    if (!isProductPdp()) return;
    var host = findRetailStackHost();
    if (!host) return;
    var box =
      global.document.querySelector("#v65-product-parent td.mc-pdp-options-td .colors_pricebox") ||
      global.document.querySelector("#v65-product-parent .colors_pricebox");
    var retailAmt = 0;
    if (box) {
      var pp = box.querySelector(".product_productprice");
      if (pp) retailAmt = parseMoney(pp.textContent || "");
      if (!(retailAmt > 0)) {
        var re = /\$[\d,]+(?:\.\d{2})?/g;
        var m;
        var text = box.textContent || "";
        while ((m = re.exec(text)) !== null) {
          var v = parseMoney(m[0]);
          if (v > 0) retailAmt = Math.max(retailAmt, v);
        }
      }
    }
    if (!(retailAmt > 0)) return;
    if (!global.document.querySelector(".mc-pdp-retail-row")) {
      var row = global.document.createElement("div");
      row.className = "mc-pdp-retail-row";
      row.innerHTML =
        '<div class="mc-pdp-retail-label">Retail Price</div>' +
        '<div class="mc-pdp-retail-line"><span class="product_list_price">' +
        fmtMoney(retailAmt) +
        "</span></div>";
      host.insertBefore(row, host.firstChild);
    }
    var wrap = ensureMemberPricingWrap();
    if (wrap && !wrap.querySelector(".mc-pdp-member-line")) {
      var locked = global.document.createElement("div");
      locked.className = "mc-pdp-member-line mc-pdp-member-line--locked";
      locked.innerHTML =
        '<span class="mc-pdp-member-line__label">Member Price</span>' +
        '<span class="mc-pdp-member-line__amount"><a href="#" data-mc-open-login>Log in</a> to see member pricing</span>';
      wrap.appendChild(locked);
    }
    if (wrap) layoutMemberLines(wrap);
    try {
      global.document.body.classList.add("mc-pdp-price-stack");
    } catch (eCls) {}
  }

  function hideNativeSaleNodes() {
    hideMainPriceboxNativeSale();
    var nodes = global.document.querySelectorAll(
      "#v65-product-parent .product_sale_price, #v65-product-parent .product_saleprice, #v65-product-parent font.product_sale_price, #v65-product-parent .colors_pricebox .product_saleprice, #v65-product-parent .colors_pricebox .product_sale_price"
    );
    nodes.forEach(function (node) {
      if (!node || (node.closest && node.closest(".mc-pdp-member-line--sale"))) return;
      if (node.closest && node.closest(".v-product-grid, .mc-related-carousel, .mc-related-plp-card")) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
      } catch (eH) {}
    });
  }

  function tidyLooseMemberLines() {
    var lines = global.document.querySelectorAll(
      "#v65-product-parent .mc-pdp-member-line, #content_area .mc-pdp-member-line"
    );
    lines.forEach(function (line) {
      if (!line || !line.style) return;
      line.style.setProperty("display", "flex", "important");
      line.style.setProperty("flex-direction", "column", "important");
      line.style.setProperty("align-items", "flex-start", "important");
      line.style.setProperty("gap", "2px", "important");
      line.style.setProperty("width", "100%", "important");
      line.style.setProperty("position", "static", "important");
      line.querySelectorAll(
        ".product_saleprice, .product_sale_price, font.product_sale_price, .mc-member-price-caption"
      ).forEach(function (node) {
        if (node.closest && node.closest(".mc-pdp-member-line__amount, .mc-pdp-member-line__label")) return;
        try {
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
        } catch (eT) {}
      });
    });
  }

  function layoutMemberLines(wrap) {
    if (!wrap || !wrap.querySelectorAll) return;
    wrap.querySelectorAll(".mc-pdp-member-line").forEach(function (line) {
      try {
        line.style.setProperty("display", "flex", "important");
        line.style.setProperty("flex-direction", "column", "important");
        line.style.setProperty("align-items", "flex-start", "important");
        line.style.setProperty("gap", "2px", "important");
        line.style.setProperty("width", "100%", "important");
        line.style.setProperty("position", "static", "important");
      } catch (eL) {}
    });
  }

  function mcEnsurePdpPriceStack() {
    if (!isProductPdp()) return false;
    ensurePdpStackCriticalCss();
    if (!hasMcPdpStackMarkers()) {
      buildMinimalRetailMemberStack();
      if (!hasMcPdpStackMarkers()) return false;
    }
    relocateRetailStackToOptionsColumn();
    try {
      global.document.body.classList.add("mc-pdp-price-stack");
    } catch (eCls) {}
    var wrap = ensureMemberPricingWrap() || global.document.querySelector(".mc-pdp-member-pricing");
    var retailRow = global.document.querySelector(".mc-pdp-retail-row");
    var saleAmt = resolvePdpSaleAmount();
    hideDuplicatePdpPriceUi();
    hideNativeSaleNodes();
    tidyLooseMemberLines();
    var loggedIn = false;
    try {
      loggedIn =
        !!(global.document.body && global.document.body.classList.contains("mc-member-logged-in")) ||
        !!global.sessionStorage.getItem("mc_recent_member_auth");
    } catch (eLi) {}
    if (!loggedIn && wrap && !wrap.querySelector(".mc-pdp-member-line--sale")) {
      if (!(saleAmt > 0)) saleAmt = resolvePdpSaleAmount();
      if (saleAmt > 0) {
        var saleLine = global.document.createElement("div");
        saleLine.className = "mc-pdp-member-line mc-pdp-member-line--sale";
        saleLine.innerHTML =
          '<span class="mc-pdp-member-line__label">Sale Price</span>' +
          '<span class="mc-pdp-member-line__amount">' +
          fmtMoney(saleAmt) +
          "</span>";
        var anchor =
          wrap.querySelector(".mc-pdp-member-line--locked") || wrap.querySelector(".mc-pdp-member-line");
        if (anchor && anchor.parentNode) {
          if (anchor.nextSibling) anchor.parentNode.insertBefore(saleLine, anchor.nextSibling);
          else anchor.parentNode.appendChild(saleLine);
        } else {
          wrap.appendChild(saleLine);
        }
      }
    }
    if (wrap) layoutMemberLines(wrap);
    if (!retailRow && typeof global.mcRenderRetailMemberOnPdp === "function") {
      try {
        global.mcRenderRetailMemberOnPdp();
      } catch (eR) {}
    }
    return true;
  }

  global.mcEnsurePdpPriceStack = mcEnsurePdpPriceStack;

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
    var legacyLogin = g.querySelector(
      'a[href*="login.asp"], a[href*="Login.asp"]'
    );
    var legacySignup = g.querySelector(
      'a[href*="register.asp"], a[href*="AccountSettings.asp"]'
    );
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
    try {
      ensurePdpStackCriticalCss();
      buildMinimalRetailMemberStack();
      relocateRetailStackToOptionsColumn();
      hideDuplicatePdpPriceUi();
      ensureMcCabeRetailStack();
      wirePlannerLoginGate();
      guardConfigurationBlockClick();
      patchCaptionSignInCta();
      try {
        mcEnsurePdpPriceStack();
      } catch (eStackRun) {}
      syncConfigurationBlockPricing();
    } catch (eRunPatch) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[McCabe] mc-pdp-auth-cta runPatch", eRunPatch);
      }
    }
    try {
      global.document
        .querySelectorAll("#options_table select, #v65-product-parent select")
        .forEach(function (sel) {
          if (sel.dataset.mcConfigPriceBound === "1") return;
          sel.dataset.mcConfigPriceBound = "1";
          sel.addEventListener("change", function () {
            try {
              inlineSyncConfigurationPrice();
            } catch (eCh) {}
          });
        });
    } catch (eBind) {}
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
    if (
      global.__MC_PDP_PENDING_LOGIN_MODAL__ &&
      typeof global.mcOpenLoginModal === "function"
    ) {
      global.__MC_PDP_PENDING_LOGIN_MODAL__ = false;
      global.mcOpenLoginModal();
    }
    if (
      global.__MC_PDP_PENDING_SIGNUP_MODAL__ &&
      typeof global.mcOpenSignupModal === "function"
    ) {
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
    var root =
      global.document.getElementById("v65-product-parent") ||
      global.document.getElementById("mcConfigurationBlock") ||
      global.document.body;
    if (root) mo.observe(root, { childList: true, subtree: true, characterData: true });
  }
})(window);

/* MC_PDP_PRICE_STACK_20260522 — load standalone repair if this cached bundle is stale */
(function (g) {
  try {
    if (typeof g.mcEnsurePdpPriceStack === "function") {
      g.mcEnsurePdpPriceStack();
      return;
    }
  } catch (e0) {}
  var d = g.document;
  if (!d || d.getElementById("mc-pdp-price-stack-loader")) return;
  var s = d.createElement("script");
  s.id = "mc-pdp-price-stack-loader";
  s.async = true;
  s.src = "/v/vspfiles/js/mc-pdp-price-stack.js?v=20260523boot&mcrd=" + Date.now();
  s.onload = function () {
    try {
      if (typeof g.mcEnsurePdpPriceStack === "function") g.mcEnsurePdpPriceStack();
    } catch (e1) {}
  };
  (d.head || d.documentElement).appendChild(s);
})(window);
