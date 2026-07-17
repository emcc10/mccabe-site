(function (window, document) {
  "use strict";

  if (!window || !document || window.__MC_TMH_ALT_VIEW_ROW_20260716__) return;
  window.__MC_TMH_ALT_VIEW_ROW_20260716__ = true;

  var ROW_ID = "mc-pdp-alt-view-row";
  var MAX_ALT_VIEWS = 24;
  var discoveredByCode = {};
  var probeInFlight = {};

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

  function heroImage() {
    return document.querySelector("img#product_photo,img#main-image");
  }

  function mediaCellFor(hero) {
    return hero && hero.closest("td.mc-pdp-media-td,td.mc-unified-pdp-media,#product_photo_td,td");
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

  function canonicalUrl(value) {
    return absoluteUrl(value).replace(/^https?:\/\/[^/]+/i, "").replace(/[?#].*$/, "").toLowerCase();
  }

  function altViewSlot(value) {
    var match = String(value || "").match(/-altview(\d+)\.(?:jpe?g|png|webp)(?:[?#]|$)/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  function addItem(items, seen, full, altText) {
    var fullUrl = absoluteUrl(full);
    var slot = altViewSlot(fullUrl);
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
        addItem(items, seen, full, image.getAttribute("alt"));
      });
    }

    Array.prototype.forEach.call(discoveredByCode[code] || [], function (item) {
      addItem(items, seen, item.full, item.alt);
    });
    items.sort(function (a, b) { return a.slot - b.slot; });
    return items;
  }

  function setHero(full) {
    var hero = heroImage();
    if (!hero || !full) return;
    hero.setAttribute("src", full);
    hero.removeAttribute("srcset");
    var zoom = document.getElementById("product_photo_zoom_url") || document.getElementById("product_photo_zoom_url2");
    if (zoom) zoom.setAttribute("href", full);
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
        var tester = new window.Image();
        tester.onload = function () {
          discoveredByCode[code].push({
            slot: photoSlot,
            full: src,
            alt: "Alternate product view " + photoSlot
          });
          schedule();
          completeOne();
        };
        tester.onerror = completeOne;
        tester.src = src;
      })(slot);
    }
  }

  /* MC_SARANONI_ALT_VIEW_ROW_20260716: Saranoni photos use {CODE}-2.jpg /
     {CODE}-2T.jpg style numbered secondary shots, not {CODE}-altviewN.jpg.
     Probe slots 2..6 (1 is always the main hero, already shown) in both the
     full-size and "T" (thumb) suffix forms; whichever resolves for a given
     slot is used for both the row thumbnail and the hero swap target. */
  var MAX_SAR_ALT_SLOT = 24;

  function probeSaranoniAltViews(code) {
    if (!code || probeInFlight[code] || discoveredByCode[code]) return;
    probeInFlight[code] = true;
    discoveredByCode[code] = [];
    var remaining = (MAX_SAR_ALT_SLOT - 1) * 2;

    function completeOne() {
      remaining -= 1;
      if (remaining > 0) return;
      probeInFlight[code] = false;
      discoveredByCode[code].sort(function (a, b) { return a.slot - b.slot; });
      render();
    }

    for (var slot = 2; slot <= MAX_SAR_ALT_SLOT; slot += 1) {
      ["", "T"].forEach(function (suffix) {
        var photoSlot = slot;
        var src = "/v/vspfiles/photos/" + code + "-" + photoSlot + suffix + ".jpg";
        var tester = new window.Image();
        tester.onload = function () {
          var already = discoveredByCode[code].some(function (item) { return item.slot === photoSlot; });
          if (!already) {
            discoveredByCode[code].push({
              slot: photoSlot,
              full: src,
              alt: "Alternate product view " + photoSlot
            });
            schedule();
          }
          completeOne();
        };
        tester.onerror = completeOne;
        tester.src = src;
      });
    }
  }

  function render() {
    var code = productCode();
    var isSaranoni = isSaranoniProductPage(code);
    if (!isMahjongProductPage(code) && !isSaranoni) return;
    var hero = heroImage();
    var mediaCell = mediaCellFor(hero);
    if (!hero || !mediaCell) return;

    var row = document.getElementById(ROW_ID);

    if (isSaranoni) {
      var sarItems = (discoveredByCode[code] || []).slice().sort(function (a, b) { return a.slot - b.slot; });
      if (!sarItems.length) {
        if (row) row.style.setProperty("display", "none", "important");
        probeSaranoniAltViews(code);
        return;
      }
      renderRow(hero, mediaCell, row, sarItems);
      return;
    }

    if (hasWorkingNativeRow(hero)) {
      if (row) row.style.setProperty("display", "none", "important");
      return;
    }

    var items = collectItems(code);
    if (!items.length) {
      if (row) row.style.setProperty("display", "none", "important");
      probeAltViews(code);
      return;
    }

    renderRow(hero, mediaCell, row, items);
  }

  /* Shared by both the Mahjong (#altviews/-altviewN probe) and Saranoni
     (-2/-2T probe) paths — builds/positions the thumbnail row and wires up
     hero-swap clicks. Nothing here is product-type-specific. */
  function renderRow(hero, mediaCell, row, items) {
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
    row.style.setProperty("visibility", "visible", "important");
    row.style.setProperty("height", "auto", "important");
    row.style.setProperty("scroll-behavior", "smooth", "important");
    row.style.setProperty("-webkit-overflow-scrolling", "touch", "important");

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
      link.style.setProperty("flex", "0 0 84px", "important");
      link.style.setProperty("width", "84px", "important");
      link.style.setProperty("height", "84px", "important");
      link.style.setProperty("margin", "0", "important");
      link.style.setProperty("padding", "0", "important");
      link.style.setProperty("overflow", "hidden", "important");
      link.style.setProperty("box-sizing", "border-box", "important");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        [0, 80, 250, 700].forEach(function (delay) {
          window.setTimeout(function () { setHero(item.full); }, delay);
        });
      });
      image.src = item.full;
      image.alt = item.alt;
      image.loading = "lazy";
      image.style.setProperty("display", "block", "important");
      image.style.setProperty("width", "84px", "important");
      image.style.setProperty("height", "84px", "important");
      image.style.setProperty("max-width", "none", "important");
      image.style.setProperty("object-fit", "cover", "important");
      image.style.setProperty("margin", "0", "important");
      image.style.setProperty("padding", "0", "important");
      image.style.setProperty("float", "none", "important");
      link.appendChild(image);
      row.appendChild(link);
    });
  }

  function schedule() {
    window.clearTimeout(schedule.timer);
    schedule.timer = window.setTimeout(render, 80);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();
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
