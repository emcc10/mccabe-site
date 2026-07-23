(function (window, document) {
  "use strict";

  /* MC_ALT_VIEW_ROW_20260723mob1 — product-code filter + suppress dual #altviews.
     New flag name so stale 20260721B caches cannot satisfy the fresh-boot gate. */
  if (!window || !document || window.__MC_TMH_ALT_VIEW_ROW_20260723mob1__) return;
  window.__MC_TMH_ALT_VIEW_ROW_20260723mob1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260721B__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX5__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX4__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX3__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260716__ = true;

  var ROW_ID = "mc-pdp-alt-view-row";
  var MAX_ALT_VIEWS = 64;
  var discoveredByCode = {};
  var probeInFlight = {};
  var stickyHeroTimer = null;

  function productCode() {
    var field = document.querySelector('input[name="ProductCode"],input[name="productcode"]');
    return String(window.global_Current_ProductCode || (field && field.value) || "").trim().toUpperCase();
  }

  function isMahjongProductPage(code) {
    if (!/^TMH-/.test(code)) return false;
    var path = String(window.location.pathname || "");
    return /\/product-p\//i.test(path) || /productdetails\.asp/i.test(path) || !!document.getElementById("v65-product-parent");
  }

  /* MC_SARANONI_ALT_VIEW_ROW_20260716 — additive Saranoni support, mirrors the
     Mahjong path above without touching it. Saranoni deliberately hides its
     native #altviews once color swatches mount (hideSaranoniHeroAltviews() in
     mc-pdp-auth-cta-fix.js) because Volusion stuffs color-option images in
     there, duplicating the swatch picker — so unlike Mahjong, we never read
     #altviews for Saranoni, only the probed {CODE}-2.jpg/-2T.jpg style numbered
     secondary photos. Those numbered-slot filenames are structurally distinct
     from color-option swatch filenames ({CODE}-{optionId}-T.jpg /
     {CODE}-{optionId}-S.jpg use a hyphen before the T/S), so probing this exact
     shape can't accidentally pick up a color swatch image. */
  function isSaranoniProductPage(code) {
    if (!/^SAR-/.test(code)) return false;
    if (/^SAR-TMH-/.test(code)) return false;
    var path = String(window.location.pathname || "");
    return /\/product-p\//i.test(path) || /productdetails\.asp/i.test(path) || !!document.getElementById("v65-product-parent");
  }

  function isAnyProductPage() {
    var path = String(window.location.pathname || "");
    return /\/product-p\//i.test(path) || /productdetails\.asp/i.test(path) || !!document.getElementById("v65-product-parent");
  }

  function heroImage() {
    return document.querySelector("img#product_photo,img#main-image");
  }

  function mediaCellFor(hero) {
    if (!hero || !hero.closest) return null;
    return (
      hero.closest("td.mc-pdp-media-td") ||
      hero.closest("td.mc-unified-pdp-media") ||
      hero.closest("#product_photo_td") ||
      hero.closest("td")
    );
  }

  function directChild(parent, node) {
    if (!parent || !node || !parent.contains(node)) return null;
    while (node.parentNode && node.parentNode !== parent) node = node.parentNode;
    return node.parentNode === parent ? node : null;
  }

  function absoluteUrl(value) {
    var url = String(value || "").trim();
    if (!url || /^javascript:/i.test(url) || url === "#") return "";
    try {
      return new window.URL(url, document.baseURI).href;
    } catch (error) {
      return url;
    }
  }

  function probeImage(src, onload, onerror) {
    /* Some browser extensions (ad/tracker blockers) silently drop image
       requests created via document.createElement("img") that are never
       attached to the DOM — neither onload nor onerror ever fires, so the
       probe hangs forever even though the image genuinely exists. Attaching
       the element (hidden, off-screen) avoids that heuristic, and a
       per-image timeout guards against anything that still gets stuck.
       Cached images can also finish before onload is useful — check
       `.complete` after setting src. */
    var tester = document.createElement("img");
    var settled = false;
    function cleanup() {
      if (tester.parentNode) tester.parentNode.removeChild(tester);
    }
    function handleLoad() {
      if (settled) return;
      settled = true;
      cleanup();
      onload();
    }
    function handleError() {
      if (settled) return;
      settled = true;
      cleanup();
      onerror();
    }
    tester.onload = handleLoad;
    tester.onerror = handleError;
    tester.setAttribute("aria-hidden", "true");
    tester.style.cssText =
      "position:absolute!important;width:1px!important;height:1px!important;" +
      "opacity:0!important;pointer-events:none!important;left:-9999px!important;top:-9999px!important;";
    (document.body || document.documentElement).appendChild(tester);
    tester.src = src;
    if (tester.complete) {
      if (tester.naturalWidth > 0) handleLoad();
      else handleError();
    }
    setTimeout(handleError, 8000);
    return tester;
  }

  function canonicalUrl(value) {
    return absoluteUrl(value).replace(/^https?:\/\/[^/]+/i, "").replace(/[?#].*$/, "").toLowerCase();
  }

  function altViewSlot(value) {
    var match = String(value || "").match(/-altview(\d+)\.(?:jpe?g|png|webp)(?:[?#]|$)/i);
    if (match) return parseInt(match[1], 10);
    match = String(value || "").match(/-(\d+)T?\.(?:jpe?g|png|webp)(?:[?#]|$)/i);
    return match ? 100 + parseInt(match[1], 10) : 0;
  }

  function addItem(items, seen, full, altText, explicitSlot) {
    var fullUrl = absoluteUrl(full);
    var slot = explicitSlot || altViewSlot(fullUrl);
    var key = canonicalUrl(fullUrl);
    if (!key || !slot || seen[key]) return;
    seen[key] = true;
    items.push({
      slot: slot,
      full: fullUrl,
      alt: String(altText || "Alternate product view " + slot)
    });
  }

  function nativeAltContainer() {
    return document.querySelector("#altviews,span#altviews,.altviews,.mc-unified-altviews,.mc-tmh-preserved-altviews");
  }

  function urlBelongsToProduct(url, code) {
    var c = String(code || "").trim().toUpperCase();
    if (!c) return true;
    var path = canonicalUrl(url);
    if (!path) return false;
    var upper = path.toUpperCase();
    var needle = "/V/VSPFILES/PHOTOS/" + c + "-";
    var needle2 = "/VSPFILES/PHOTOS/" + c + "-";
    return upper.indexOf(needle) !== -1 || upper.indexOf(needle2) !== -1;
  }

  function collectItems(code) {
    var items = [];
    var seen = {};
    var nativeAlt = nativeAltContainer();
    if (nativeAlt) {
      Array.prototype.forEach.call(nativeAlt.querySelectorAll("img"), function (image) {
        var link = image.closest("a");
        var full =
          (link && link.getAttribute("data-full")) ||
          image.getAttribute("data-zoom-image") ||
          image.getAttribute("data-large") ||
          image.getAttribute("data-full") ||
          image.getAttribute("data-image") ||
          (link && link.getAttribute("href")) ||
          image.currentSrc ||
          image.getAttribute("src") ||
          "";
        if (/^javascript:/i.test(full)) full = image.currentSrc || image.getAttribute("src") || "";
        if (!urlBelongsToProduct(full, code)) return;
        addItem(items, seen, full, image.getAttribute("alt"));
      });
    }

    Array.prototype.forEach.call(discoveredByCode[code] || [], function (item) {
      if (!urlBelongsToProduct(item.full, code)) return;
      addItem(items, seen, item.full, item.alt, item.slot);
    });
    items.sort(function (a, b) { return a.slot - b.slot; });
    if (code === "MOLLY-OLSON-DINING-SET") {
      // The first supplier alt is the hero image repeated under a different
      // filename. Keep the three distinct chair/detail views instead.
      // altview9 is a mismatched supplier photo -- a dark wood ladder-back
      // chair on a jute rug, nothing like the Molly Olson's khaki upholstered
      // mid-century chairs or its round pedestal table shown in the other
      // alt views. Confirmed visually 2026-07-21.
      items = items.filter(function (item) {
        return !/(?:-altview1|-altview9|-1|-2t)\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(item.full);
      });
    }
    return items;
  }

  function publishActiveHero(full) {
    if (!full) return;
    try {
      window.__MC_PDP_ALT_VIEW_ACTIVE_SRC__ = absoluteUrl(full);
      window.__MC_PDP_ALT_VIEW_ACTIVE_AT__ = Date.now();
    } catch (error) {}
  }

  function setHero(full) {
    var hero = heroImage();
    if (!hero || !full) return;
    var next = absoluteUrl(full);
    publishActiveHero(next);
    hero.setAttribute("src", next);
    hero.removeAttribute("srcset");
    /* mc-pdp-auth-cta-form.js's ensureSteveSilverHeroPhotoSrc() forces
       #product_photo back to {code}-1.jpg on every sync pass unless this
       flag is set -- it already checks for it, nothing ever set it, so an
       alt-view click swapped the image for a moment and then the next sync
       pass silently reverted it (SS-* product codes only; that guard
       doesn't run for closeout codes, which is why those never reverted). */
    try {
      hero.__mcSsUserSelectedAlt = true;
    } catch (eFlag) {}
    var zoom = document.getElementById("product_photo_zoom_url") || document.getElementById("product_photo_zoom_url2");
    if (zoom) zoom.setAttribute("href", next);
    try {
      if (window.vZoom && typeof window.vZoom.add === "function") window.vZoom.add(hero, next);
    } catch (eZoom) {}
  }

  function holdHero(full) {
    var started = Date.now();
    setHero(full);
    window.clearInterval(stickyHeroTimer);
    stickyHeroTimer = window.setInterval(function () {
      var active = "";
      try {
        active = String(window.__MC_PDP_ALT_VIEW_ACTIVE_SRC__ || "");
      } catch (error) {}
      if (!active || active !== absoluteUrl(full) || Date.now() - started > 10000) {
        window.clearInterval(stickyHeroTimer);
        stickyHeroTimer = null;
        return;
      }
      var hero = heroImage();
      if (hero && (hero.getAttribute("src") || "") !== active) setHero(active);
    }, 120);
  }

  function variantHeroFromClickTarget(target) {
    if (!target || !target.closest) return "";
    var btn = target.closest(".mc-configured-color-swatch,.mc-saranoni-color-picker__thumbs a,[data-main-image]");
    if (!btn) return "";
    var main = btn.getAttribute("data-main-image") || "";
    var optionId = btn.getAttribute("data-option-id") || "";
    var code = productCode();
    if (main) {
      if (/^(?:https?:)?\/\//i.test(main) || main.charAt(0) === "/") return absoluteUrl(main);
      return absoluteUrl("/v/vspfiles/photos/" + main);
    }
    if (code && optionId) return absoluteUrl("/v/vspfiles/photos/" + code + "-" + optionId + "-T.jpg");
    var img = btn.querySelector ? btn.querySelector("img") : null;
    return img ? absoluteUrl(img.currentSrc || img.getAttribute("src") || "") : "";
  }

  function hasWorkingNativeRow(hero) {
    var nativeAlt = nativeAltContainer();
    if (!nativeAlt || nativeAlt.id === ROW_ID || nativeAlt.contains(document.getElementById(ROW_ID))) return false;
    var markedImages = Array.prototype.filter.call(nativeAlt.querySelectorAll("img"), function (image) {
      return altViewSlot(image.currentSrc || image.getAttribute("src"));
    });
    if (!markedImages.length) return false;
    var style = window.getComputedStyle(nativeAlt);
    var rect = nativeAlt.getBoundingClientRect();
    var heroRect = hero.getBoundingClientRect();
    var visibleImages = markedImages.filter(function (image) {
      var imageStyle = window.getComputedStyle(image);
      var imageRect = image.getBoundingClientRect();
      return imageStyle.display !== "none" && imageStyle.visibility !== "hidden" && imageRect.width > 0 && imageRect.height > 0;
    });
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && visibleImages.length > 0 && rect.top >= heroRect.bottom - 2;
  }

  function probeAltViews(code) {
    if (!code || probeInFlight[code] || discoveredByCode[code]) return;
    probeInFlight[code] = true;
    discoveredByCode[code] = [];
    var remaining = MAX_ALT_VIEWS;

    function completeOne() {
      remaining -= 1;
      if (remaining > 0) return;
      probeInFlight[code] = false;
      discoveredByCode[code].sort(function (a, b) { return a.slot - b.slot; });
      render();
    }

    for (var slot = 1; slot <= MAX_ALT_VIEWS; slot += 1) {
      (function (photoSlot) {
        var src = "/v/vspfiles/photos/" + code + "-altview" + photoSlot + ".jpg";
        probeImage(src, function () {
          discoveredByCode[code].push({
            slot: photoSlot,
            full: src,
            alt: "Alternate product view " + photoSlot
          });
          schedule();
          completeOne();
        }, completeOne);
      })(slot);
    }
  }

  function probeGenericAltViews(code) {
    if (!code || probeInFlight[code] || discoveredByCode[code]) return;
    probeInFlight[code] = true;
    discoveredByCode[code] = [];
    var remaining = MAX_ALT_VIEWS + (MAX_ALT_VIEWS - 1) * 2;

    function completeOne() {
      remaining -= 1;
      if (remaining <= 0) {
        probeInFlight[code] = false;
        render();
      }
    }

    function addItem(slot, src, labelPrefix) {
      var already = discoveredByCode[code].some(function (item) {
        return item.slot === slot || canonicalUrl(item.full) === canonicalUrl(src);
      });
      if (already) return;
      discoveredByCode[code].push({
        slot: slot,
        full: src,
        alt: labelPrefix + " " + slot
      });
      schedule();
    }

    for (var altSlot = 1; altSlot <= MAX_ALT_VIEWS; altSlot += 1) {
      (function (photoSlot) {
        var src = "/v/vspfiles/photos/" + code + "-altview" + photoSlot + ".jpg";
        probeImage(src, function () {
          addItem(photoSlot, src, "Alternate product view");
          completeOne();
        }, completeOne);
      })(altSlot);
    }

    for (var slot = 2; slot <= MAX_ALT_VIEWS; slot += 1) {
      ["", "T"].forEach(function (suffix) {
        var photoSlot = slot;
        var legacySrc = "/v/vspfiles/photos/" + code + "-" + photoSlot + suffix + ".jpg";
        probeImage(legacySrc, function () {
          addItem(100 + photoSlot, legacySrc, "Alternate product view");
          completeOne();
        }, completeOne);
      });
    }
  }

  /* MC_SARANONI_ALT_VIEW_ROW_20260720sarfix1: Saranoni gallery assets use the
     shared {CODE}-altviewN.jpg convention. Keep older -2/-2T probes as a
     fallback. Prefer non-T over -NT for the same slot, and allow re-probe when
     the first pass found nothing (empty-array latch used to block forever). */
  var MAX_SAR_ALT_SLOT = 24;
  var saranoniProbeDone = {};

  function saranoniIsTFile(src) {
    return /-\d+T\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(String(src || ""));
  }

  function addSaranoniDiscovered(code, slot, src) {
    var list = discoveredByCode[code] || (discoveredByCode[code] = []);
    var idx = -1;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].slot === slot) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      /* Prefer non-T lifestyle/detail over the smaller -NT closeup. */
      if (saranoniIsTFile(list[idx].full) && !saranoniIsTFile(src)) {
        list[idx] = {
          slot: slot,
          full: src,
          alt: "Alternate product view " + slot
        };
        schedule();
      }
      return;
    }
    list.push({
      slot: slot,
      full: src,
      alt: "Alternate product view " + slot
    });
    schedule();
  }

  function probeSaranoniAltViews(code) {
    if (!code || probeInFlight[code]) return;
    /* Allow re-probe when a prior pass latched empty (CDN race / blocked imgs). */
    if (saranoniProbeDone[code] && (discoveredByCode[code] || []).length) return;
    /* Keep any discoveries already found — never wipe mid-flight successes. */
    if (!discoveredByCode[code]) discoveredByCode[code] = [];
    if ((discoveredByCode[code] || []).length) {
      saranoniProbeDone[code] = true;
      render();
      return;
    }
    probeInFlight[code] = true;
    var remaining = MAX_SAR_ALT_SLOT;
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      probeInFlight[code] = false;
      saranoniProbeDone[code] = true;
      discoveredByCode[code].sort(function (a, b) { return a.slot - b.slot; });
      /* If nothing found, clear the latch so a later schedule can retry. */
      if (!(discoveredByCode[code] || []).length) {
        saranoniProbeDone[code] = false;
      }
      render();
    }

    setTimeout(finish, 10000);

    function completeOne() {
      remaining -= 1;
      if (remaining > 0) return;
      finish();
    }

    for (var altSlot = 1; altSlot <= MAX_SAR_ALT_SLOT; altSlot += 1) {
      (function (photoSlot) {
        var src = "/v/vspfiles/photos/" + code + "-altview" + photoSlot + ".jpg";
        /* Image probes (DOM-attached) are more reliable than fetch on Volusion CDN. */
        probeImage(
          src,
          function () {
            addSaranoniDiscovered(code, photoSlot, src);
            completeOne();
          },
          completeOne
        );
      })(altSlot);
    }
  }

  function render() {
    var code = productCode();
    var isSaranoni = isSaranoniProductPage(code);
    var isMahjong = isMahjongProductPage(code);
    var isGenericPdp = isAnyProductPage() && !!code && !isSaranoni && !isMahjong;
    if (!isMahjong && !isSaranoni && !isGenericPdp) return;
    var hero = heroImage();
    var mediaCell = mediaCellFor(hero);
    if (!hero || !mediaCell) return;

    var row = document.getElementById(ROW_ID);

    if (isSaranoni) {
      var heroCanon = canonicalUrl(hero.currentSrc || hero.getAttribute("src") || "");
      var sarItems = (discoveredByCode[code] || [])
        .slice()
        .filter(function (item) {
          return canonicalUrl(item.full) !== heroCanon;
        })
        .sort(function (a, b) { return a.slot - b.slot; });
      if (!sarItems.length) {
        /* Keep an already-built row visible while re-probing. */
        if (!(row && row.children && row.children.length)) {
          if (row) row.style.setProperty("display", "none", "important");
        }
        probeSaranoniAltViews(code);
        return;
      }
      renderRow(hero, mediaCell, row, sarItems);
      return;
    }

    var items = collectItems(code);
    if (!items.length) {
      if (row) row.style.setProperty("display", "none", "important");
      if (isGenericPdp) probeGenericAltViews(code);
      else probeAltViews(code);
      return;
    }

    var nativeAlt = nativeAltContainer();
    if (nativeAlt && nativeAlt.id !== ROW_ID && !nativeAlt.contains(row)) {
      nativeAlt.style.setProperty("display", "none", "important");
      nativeAlt.style.setProperty("visibility", "hidden", "important");
      nativeAlt.style.setProperty("height", "0", "important");
      nativeAlt.style.setProperty("max-height", "0", "important");
      nativeAlt.style.setProperty("overflow", "hidden", "important");
      nativeAlt.style.setProperty("margin", "0", "important");
      nativeAlt.style.setProperty("padding", "0", "important");
      nativeAlt.setAttribute("data-mc-altviews-suppressed", "1");
      try {
        if (document.body) document.body.classList.add("mc-pdp-custom-alt-row");
      } catch (eCls) {}
    }

    renderRow(hero, mediaCell, row, items);
  }

  /* Shared by both the Mahjong (#altviews/-altviewN probe) and Saranoni
     (-2/-2T probe) paths — builds/positions the thumbnail row and wires up
     hero-swap clicks. Nothing here is product-type-specific. */
  function renderRow(hero, mediaCell, row, items) {
    ensureAltRowCss();
    if (!row) {
      row = document.createElement("div");
      row.id = ROW_ID;
      row.setAttribute("role", "region");
      row.setAttribute("aria-label", "Alternate product views");
      var heroBlock = directChild(mediaCell, hero);
      if (heroBlock) mediaCell.insertBefore(row, heroBlock.nextSibling || null);
      else mediaCell.appendChild(row);
    } else if (row.parentNode !== mediaCell) {
      var currentHeroBlock = directChild(mediaCell, hero);
      if (currentHeroBlock) mediaCell.insertBefore(row, currentHeroBlock.nextSibling || null);
      else mediaCell.appendChild(row);
    }

    var heroWidth = Math.round(hero.getBoundingClientRect().width || hero.offsetWidth || 0);
    row.style.setProperty("display", "flex", "important");
    row.style.setProperty("flex-wrap", "nowrap", "important");
    row.style.setProperty("align-items", "center", "important");
    row.style.setProperty("justify-content", "flex-start", "important");
    row.style.setProperty("order", "2", "important");
    var visibleCount = Math.min(items.length, 3);
    var thumbSize = Math.max(
      48,
      Math.min(84, Math.floor((heroWidth - Math.max(visibleCount - 1, 0) * 8) / Math.max(visibleCount, 1)))
    );
    row.style.setProperty("gap", "8px", "important");
    row.style.setProperty("width", "100%", "important");
    row.style.setProperty("max-width", heroWidth ? heroWidth + "px" : "100%", "important");
    row.style.setProperty("margin", "10px auto 0", "important");
    row.style.setProperty("padding", "0 0 6px", "important");
    row.style.setProperty("overflow-x", "auto", "important");
    row.style.setProperty("overflow-y", "hidden", "important");
    row.style.setProperty("box-sizing", "border-box", "important");
    row.style.setProperty("clear", "both", "important");
    row.style.setProperty("float", "none", "important");
    row.style.setProperty("position", "relative", "important");
    row.style.setProperty("z-index", "1", "important");
    row.style.setProperty("visibility", "visible", "important");
    row.style.setProperty("height", "auto", "important");
    row.style.setProperty("scroll-behavior", "smooth", "important");
    row.style.setProperty("-webkit-overflow-scrolling", "touch", "important");
    row.style.setProperty("scrollbar-width", "none", "important");
    row.style.setProperty("-ms-overflow-style", "none", "important");

    var signature = items.map(function (item) { return canonicalUrl(item.full); }).join("|");
    if (row.getAttribute("data-mc-items") === signature) return;
    row.setAttribute("data-mc-items", signature);
    while (row.firstChild) row.removeChild(row.firstChild);

    items.forEach(function (item) {
      var link = document.createElement("a");
      var image = document.createElement("img");
      link.href = item.full;
      link.setAttribute("data-mc-tmh-alt-slot", String(item.slot));
      link.setAttribute("aria-label", "View alternate product image " + item.slot);
      link.style.setProperty("display", "block", "important");
      link.style.setProperty("flex", "0 0 " + thumbSize + "px", "important");
      link.style.setProperty("width", thumbSize + "px", "important");
      link.style.setProperty("height", thumbSize + "px", "important");
      link.style.setProperty("margin", "0", "important");
      link.style.setProperty("padding", "0", "important");
      link.style.setProperty("overflow", "hidden", "important");
      link.style.setProperty("box-sizing", "border-box", "important");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        holdHero(item.full);
      });
      image.src = item.full;
      image.alt = item.alt;
      image.loading = "lazy";
      image.style.setProperty("display", "block", "important");
      image.style.setProperty("width", thumbSize + "px", "important");
      image.style.setProperty("height", thumbSize + "px", "important");
      image.style.setProperty("max-width", "none", "important");
      image.style.setProperty("object-fit", "cover", "important");
      image.style.setProperty("margin", "0", "important");
      image.style.setProperty("padding", "0", "important");
      image.style.setProperty("float", "none", "important");
      link.appendChild(image);
      row.appendChild(link);
    });
  }

  function ensureAltRowCss() {
    var id = "mc-pdp-alt-view-row-css";
    if (document.getElementById(id)) return;
    var st = document.createElement("style");
    st.id = id;
    st.textContent =
      "#mc-pdp-alt-view-row{display:flex!important;position:relative!important;clear:both!important;float:none!important;z-index:1!important;scrollbar-width:none!important;-ms-overflow-style:none!important}" +
      "#mc-pdp-alt-view-row::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;background:transparent!important}" +
      "#mc-pdp-alt-view-row a,#mc-pdp-alt-view-row img{float:none!important;position:relative!important;z-index:1!important}" +
      /* Keep custom alt thumbs below the hero when the media cell is a flex column
         and #product_photo is forced to order:1 (template_266 mobile stack). */
      "@media (max-width:991px){#mc-pdp-alt-view-row{order:2!important;margin-top:10px!important}}" ;
    (document.head || document.documentElement).appendChild(st);
  }

  function schedule() {
    window.clearTimeout(schedule.timer);
    schedule.timer = window.setTimeout(render, 80);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();
  document.addEventListener("click", function (event) {
    if (!isSaranoniProductPage(productCode())) return;
    var full = variantHeroFromClickTarget(event.target);
    if (!full) return;
    holdHero(full);
  }, true);
  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
  [300, 900, 1800, 3500, 7000, 11000].forEach(function (delay) {
    window.setTimeout(schedule, delay);
  });
  if (window.MutationObserver) {
    var observer = new window.MutationObserver(schedule);
    observer.observe(document.getElementById("v65-product-parent") || document.body, { childList: true, subtree: true });
  }
})(window, document);
