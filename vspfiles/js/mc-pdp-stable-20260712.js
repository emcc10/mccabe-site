/* MC_PDP_STABLE_20260712pdp03
   Burlington / Steve Silver closeout stability.
   Proof-based fixes for:
   - hero min-width/padding overflow into accordion (overlap)
   - duplicate identical -2T alt thumbs
   - related items not sharing centered 1200 shell
   - layout thrash from competing timers (lock once, then stop)
*/
(function (g, d) {
  "use strict";
  var VER = "20260713tblfix1";
  if (g.__MC_PDP_STABLE_VER__ === VER) return;
  g.__MC_PDP_STABLE_VER__ = VER;
  g.__MC_PDP_LAYOUT_HOTFIX_VER__ = VER;
  g.__MC_SKIP_NUMBERED_ALTS__ = true;

  function isPdp() {
    try {
      return !!(
        (d.body &&
          (d.body.classList.contains("productdetails") ||
            d.body.classList.contains("mc-product-page"))) ||
        d.getElementById("v65-product-parent")
      );
    } catch (e) {
      return false;
    }
  }
  function desktop() {
    return !!(g.matchMedia && g.matchMedia("(min-width: 992px)").matches);
  }
  function set(el, prop, val) {
    if (el && el.style) el.style.setProperty(prop, val, "important");
  }
  function productCode() {
    var input = d.querySelector('input[name="ProductCode"], input[name="productcode"]');
    return String((g.global_Current_ProductCode || "") || (input && input.value) || "")
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "");
  }

  function injectCss() {
    var id = "mc-pdp-stable-css";
    var st = d.getElementById(id);
    if (st && st.getAttribute("data-ver") === VER) return;
    if (st && st.parentNode) st.parentNode.removeChild(st);
    st = d.createElement("style");
    st.id = id;
    st.setAttribute("data-ver", VER);
    st.textContent =
      "@media (min-width:992px){" +
      "html body.mc-product-page #content_area,html body.productdetails #content_area," +
      "html body.mc-product-page #v65-product-parent,html body.productdetails #v65-product-parent," +
      "html body.mc-product-page #v65-product-related,html body.productdetails #v65-product-related{" +
      "max-width:1200px!important;width:100%!important;margin-left:auto!important;margin-right:auto!important;" +
      "padding-left:0!important;padding-right:0!important;float:none!important;box-sizing:border-box!important}" +
      "html body.mc-product-page #v65-product-related,html body.productdetails #v65-product-related{table-layout:fixed!important}" +
      "html body.mc-product-page #v65-product-related>tbody>tr>td,html body.productdetails #v65-product-related>tbody>tr>td{width:100%!important;max-width:1200px!important}" +
      "html body.mc-product-page #v65-product-parent tr.mc-pdp-main-row," +
      "html body.productdetails #v65-product-parent tr.mc-pdp-main-row," +
      "html body.mc-product-page #v65-product-parent tr.mc-unified-pdp-row," +
      "html body.productdetails #v65-product-parent tr.mc-unified-pdp-row{" +
      "display:flex!important;flex-direction:row!important;justify-content:center!important;align-items:flex-start!important;" +
      "gap:40px!important;max-width:1200px!important;width:100%!important;margin:0 auto!important;padding:0!important}" +
      "html body.mc-product-page #v65-product-parent td.mc-pdp-media-td," +
      "html body.productdetails #v65-product-parent td.mc-pdp-media-td," +
      "html body.mc-product-page #v65-product-parent td.mc-unified-pdp-media," +
      "html body.productdetails #v65-product-parent td.mc-unified-pdp-media{" +
      "flex:0 0 650px!important;width:650px!important;max-width:650px!important;padding:0!important;min-width:0!important}" +
      "html body.mc-product-page #v65-product-parent td.mc-pdp-options-td," +
      "html body.productdetails #v65-product-parent td.mc-pdp-options-td," +
      "html body.mc-product-page #v65-product-parent td.mc-unified-pdp-info," +
      "html body.productdetails #v65-product-parent td.mc-unified-pdp-info{" +
      "flex:0 0 420px!important;width:420px!important;max-width:420px!important;padding:0!important;min-width:0!important}" +
      "html body.mc-product-page img#product_photo,html body.productdetails img#product_photo{" +
      "width:650px!important;max-width:100%!important;min-width:0!important;height:auto!important;display:block!important}" +
      "html body.mc-product-page .mc-related-plp-grid,html body.productdetails .mc-related-plp-grid{" +
      "display:flex!important;flex-wrap:wrap!important;justify-content:center!important;width:100%!important;" +
      "max-width:1200px!important;margin:0 auto!important;gap:16px!important}" +
      "}" +
      "@media (max-width:991px){" +
      "html body.mc-product-page #content_area,html body.productdetails #content_area," +
      "html body.mc-product-page #v65-product-parent,html body.productdetails #v65-product-parent," +
      "html body.mc-product-page #v65-product-related,html body.productdetails #v65-product-related{" +
      "max-width:100%!important;width:100%!important;margin:0 auto!important;padding:0 12px!important;" +
      "box-sizing:border-box!important;overflow-x:hidden!important}" +
      "html body.mc-product-page #v65-product-parent tr.mc-pdp-main-row," +
      "html body.productdetails #v65-product-parent tr.mc-pdp-main-row," +
      "html body.mc-product-page #v65-product-parent tr.mc-unified-pdp-row," +
      "html body.productdetails #v65-product-parent tr.mc-unified-pdp-row{" +
      "display:flex!important;flex-direction:column!important;width:100%!important;margin:0!important;gap:12px!important;" +
      "transform:none!important}" +
      "html body.mc-product-page #v65-product-parent td.mc-pdp-media-td," +
      "html body.productdetails #v65-product-parent td.mc-pdp-media-td," +
      "html body.mc-product-page #v65-product-parent td.mc-unified-pdp-media," +
      "html body.productdetails #v65-product-parent td.mc-unified-pdp-media," +
      "html body.mc-product-page #v65-product-parent td.mc-pdp-options-td," +
      "html body.productdetails #v65-product-parent td.mc-pdp-options-td," +
      "html body.mc-product-page #v65-product-parent td.mc-unified-pdp-info," +
      "html body.productdetails #v65-product-parent td.mc-unified-pdp-info{" +
      "display:block!important;width:100%!important;max-width:100%!important;padding:0!important;margin:0!important;" +
      "flex:none!important;min-width:0!important;transform:none!important}" +
      "html body.mc-product-page img#product_photo,html body.productdetails img#product_photo{" +
      "width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important}" +
      "html body.mc-product-page .mc-related-plp-grid,html body.productdetails .mc-related-plp-grid{" +
      "display:flex!important;flex-direction:column!important;align-items:stretch!important;width:100%!important;" +
      "max-width:100%!important;margin:0 auto!important}" +
      "}" +
      "#altviews.mc-altviews-empty,#mc-steve-silver-altviews-wrap.mc-altviews-empty," +
      "#mc-centered-altviews-wrap.mc-altviews-empty{display:none!important;height:0!important;overflow:hidden!important}";
    (d.head || d.documentElement).appendChild(st);
  }

  function clearDuplicateAlts() {
    /* Claim SS alt ownership so older builders stop rewriting. */
    g.__MC_SS_ALT_LAYOUT_VER__ = "20260711pdpfix1";
    g.__MC_SS_ALT_RUN_VER__ = "20260711pdpfix1";
    g.__MC_SKIP_NUMBERED_ALTS__ = true;

    var code = productCode();
    var hero = d.getElementById("product_photo");
    var heroSrc = (hero && (hero.getAttribute("src") || hero.src)) || "";
    var heroBase = heroSrc
      .split("?")[0]
      .split("/")
      .pop()
      .toUpperCase()
      .replace(/-(\d+)T\./, "-$1.");

    var alt = d.getElementById("altviews");
    var wrap =
      d.getElementById("mc-steve-silver-altviews-wrap") ||
      d.getElementById("mc-centered-altviews-wrap");

    function hideAll() {
      if (alt) {
        alt.innerHTML = "";
        alt.classList.add("mc-altviews-empty");
        alt.classList.remove("mc-built-numbered-altviews");
        set(alt, "display", "none");
      }
      if (wrap) {
        wrap.classList.add("mc-altviews-empty");
        set(wrap, "display", "none");
      }
      var legacy = d.getElementById("mc-pdp-alt-filename-gallery");
      if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
    }

    /* Always strip numbered -2T spam first. */
    if (alt && (/mc-built-numbered-altviews/.test(alt.className || "") || (alt.querySelectorAll("a").length > 1))) {
      var srcs = [];
      alt.querySelectorAll("img").forEach(function (im) {
        srcs.push(
          String(im.getAttribute("src") || im.src || "")
            .split("?")[0]
            .split("/")
            .pop()
            .toUpperCase()
            .replace(/-(\d+)T\./, "-$1.")
        );
      });
      var uniq = {};
      srcs.forEach(function (s) {
        uniq[s] = 1;
      });
      var keys = Object.keys(uniq);
      /* All same file, or only -2 matching hero family → hide */
      if (keys.length <= 1) {
        hideAll();
        return;
      }
    }

    if (!code) {
      hideAll();
      return;
    }

    if (alt && alt.getAttribute("data-mc-stable-alt") === VER + ":" + code && !alt.querySelector("a")) {
      hideAll();
      return;
    }
    if (alt && alt.getAttribute("data-mc-stable-alt") === VER + ":" + code && alt.querySelector("a[data-mc-stable-only]")) {
      return;
    }

    if (!alt) {
      alt = d.createElement("span");
      alt.id = "altviews";
      alt.className = "altviews mc-built-altview-files";
    }
    alt.setAttribute("data-mc-stable-alt", VER + ":" + code);
    alt.setAttribute("data-mc-alt-built", VER + ":" + code);
    alt.setAttribute("data-mc-ss-alt-built", code);
    alt.classList.remove("mc-built-numbered-altviews");
    alt.innerHTML = "";

    var media =
      d.querySelector("td.mc-pdp-media-td, td.mc-unified-pdp-media") ||
      (hero && hero.closest && hero.closest("td"));
    if (!wrap) {
      wrap = d.createElement("div");
      wrap.id = "mc-steve-silver-altviews-wrap";
    }
    if (media && wrap.parentNode !== media) {
      var anchor = (hero && hero.closest && hero.closest("a")) || hero;
      if (anchor && media.contains(anchor)) {
        var after = anchor;
        while (after.parentNode && after.parentNode !== media) after = after.parentNode;
        media.insertBefore(wrap, after.nextSibling);
      } else media.appendChild(wrap);
    }
    if (alt.parentNode !== wrap) wrap.appendChild(alt);

    var added = 0;
    var seen = {};

    function sameAsHero(url) {
      var base = String(url || "")
        .split("?")[0]
        .split("/")
        .pop()
        .toUpperCase()
        .replace(/-(\d+)T\./, "-$1.");
      if (!base || !heroBase) return false;
      if (base === heroBase) return true;
      var hn = (heroBase.match(/-(\d+)\./) || [])[1];
      var bn = (base.match(/-(\d+)\./) || [])[1];
      return !!(hn && bn && hn === bn);
    }

    function add(url) {
      var key = String(url || "")
        .split("?")[0]
        .toUpperCase();
      if (!key || seen[key] || sameAsHero(url)) return;
      seen[key] = true;
      var a = d.createElement("a");
      a.href = url;
      a.setAttribute("data-mc-stable-only", "1");
      var img = d.createElement("img");
      img.className = "vCSS_img_alternate_product_photo";
      img.alt = "Alternate view";
      img.src = url;
      a.appendChild(img);
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (hero) {
          hero.src = url;
          hero.setAttribute("src", url);
        }
        return false;
      });
      set(a, "display", "inline-block");
      set(a, "width", "72px");
      set(a, "height", "72px");
      set(img, "width", "72px");
      set(img, "height", "72px");
      set(img, "object-fit", "contain");
      alt.appendChild(a);
      added++;
    }

    function probe(urls, cb) {
      var i = 0;
      function next() {
        if (i >= urls.length) {
          cb(null);
          return;
        }
        var u = urls[i++];
        var im = new Image();
        im.onload = function () {
          cb(u);
        };
        im.onerror = next;
        im.src = u;
      }
      next();
    }

    var queue = [];
    var n;
    /* Only real altview files — numbered -2/-2T are often identical to the hero. */
    for (n = 1; n <= 12; n++) {
      queue.push([
        "/v/vspfiles/photos/" + code + "-altview" + n + ".jpg",
        "/v/vspfiles/photos/" + code + "-altview-" + n + ".jpg",
      ]);
    }

    var qi = 0;
    function run() {
      if (qi >= queue.length) {
        if (added === 0) hideAll();
        else {
          alt.classList.remove("mc-altviews-empty");
          wrap.classList.remove("mc-altviews-empty");
          set(wrap, "display", "flex");
          set(wrap, "flex-wrap", "wrap");
          set(wrap, "gap", "8px");
          set(alt, "display", "flex");
          set(alt, "flex-wrap", "wrap");
          set(alt, "gap", "8px");
          set(alt, "width", "auto");
          set(alt, "max-width", "650px");
        }
        return;
      }
      probe(queue[qi++], function (url) {
        if (url) add(url);
        run();
      });
    }
    run();
  }

  function lockLayout() {
    if (!isPdp()) return;
    injectCss();
    var desk = desktop();
    var content = d.getElementById("content_area");
    var parent = d.getElementById("v65-product-parent");
    var row =
      d.querySelector("#v65-product-parent tr.mc-pdp-main-row") ||
      d.querySelector("#v65-product-parent tr.mc-unified-pdp-row") ||
      d.querySelector("#v65-product-parent tr.vol-product__top__inner");
    var media = d.querySelector(
      "#v65-product-parent td.mc-pdp-media-td, #v65-product-parent td.mc-unified-pdp-media"
    );
    var info = d.querySelector(
      "#v65-product-parent td.mc-pdp-options-td, #v65-product-parent td.mc-unified-pdp-info"
    );
    var hero = d.getElementById("product_photo");
    var related = d.getElementById("v65-product-related");
    var relatedContent = d.getElementById("related_products_content");
    var grid = d.querySelector(".mc-related-plp-grid");

    [content, parent, related, relatedContent].forEach(function (el) {
      set(el, "max-width", desk ? "1200px" : "100%");
      set(el, "width", "100%");
      set(el, "margin-left", "auto");
      set(el, "margin-right", "auto");
      set(el, "float", "none");
      set(el, "padding-left", desk ? "0" : "12px");
      set(el, "padding-right", desk ? "0" : "12px");
      set(el, "box-sizing", "border-box");
      set(el, "transform", "none");
    });
    if (row) {
      set(row, "display", "flex");
      set(row, "flex-direction", desk ? "row" : "column");
      set(row, "justify-content", "center");
      set(row, "align-items", desk ? "flex-start" : "stretch");
      set(row, "gap", desk ? "40px" : "12px");
      set(row, "max-width", desk ? "1200px" : "100%");
      set(row, "width", "100%");
      set(row, "margin-left", "auto");
      set(row, "margin-right", "auto");
      set(row, "padding", "0");
      set(row, "transform", "none");
    }
    if (media) {
      set(media, "padding", "0");
      set(media, "margin", "0");
      set(media, "min-width", "0");
      set(media, "display", "block");
      set(media, "float", "none");
      set(media, "flex", desk ? "0 0 650px" : "none");
      set(media, "width", desk ? "650px" : "100%");
      set(media, "max-width", desk ? "650px" : "100%");
    }
    if (info) {
      set(info, "padding", "0");
      set(info, "margin", "0");
      set(info, "min-width", "0");
      set(info, "display", "block");
      set(info, "float", "none");
      set(info, "flex", desk ? "0 0 420px" : "none");
      set(info, "width", desk ? "420px" : "100%");
      set(info, "max-width", desk ? "420px" : "100%");
    }
    if (hero) {
      set(hero, "min-width", "0");
      set(hero, "width", desk ? "650px" : "100%");
      set(hero, "max-width", "100%");
      set(hero, "height", "auto");
      set(hero, "display", "block");
      set(hero, "margin", "0");
    }
    if (grid) {
      set(grid, "display", "flex");
      set(grid, "flex-wrap", desk ? "wrap" : "nowrap");
      set(grid, "flex-direction", desk ? "row" : "column");
      set(grid, "justify-content", "center");
      set(grid, "align-items", desk ? "stretch" : "stretch");
      set(grid, "width", "100%");
      set(grid, "max-width", desk ? "1200px" : "100%");
      set(grid, "margin-left", "auto");
      set(grid, "margin-right", "auto");
      set(grid, "gap", "16px");
    }
    try {
      if (d.body) {
        d.body.classList.remove("mc-pdp-hero-pending");
        d.body.classList.add("mc-pdp-hero-ready");
      }
    } catch (eB) {}
  }

  function neuterMobileStripe() {
    if (desktop()) return;
    d.querySelectorAll('script[src*="js.stripe.com"],script[src*="stripe-push-cart"]').forEach(
      function (s) {
        try {
          s.type = "text/plain";
          s.removeAttribute("src");
          if (s.parentNode) s.parentNode.removeChild(s);
        } catch (e) {}
      }
    );
  }

  var passes = 0;
  function run() {
    if (!isPdp()) return;
    neuterMobileStripe();
    lockLayout();
    clearDuplicateAlts();
    passes++;
  }

  run();
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", run);
  g.addEventListener("load", run);
  /* Settle against late auth alt builders, then stop (avoids twitch). */
  [200, 600, 1200, 2500, 4500, 7000].forEach(function (ms) {
    g.setTimeout(run, ms);
  });
  try {
    var altWatch = d.getElementById("altviews") || d.body;
    if (altWatch && g.MutationObserver && !g.__MC_STABLE_ALT_MO__) {
      g.__MC_STABLE_ALT_MO__ = true;
      var moTicks = 0;
      var mo = new g.MutationObserver(function () {
        moTicks++;
        if (moTicks > 40) {
          try {
            mo.disconnect();
          } catch (eD) {}
          return;
        }
        clearDuplicateAlts();
        lockLayout();
      });
      mo.observe(d.documentElement, { childList: true, subtree: true });
      g.setTimeout(function () {
        try {
          mo.disconnect();
        } catch (eD2) {}
      }, 10000);
    }
  } catch (eMo) {}
  g.addEventListener("resize", function () {
    g.setTimeout(lockLayout, 50);
  });
})(window, document);
