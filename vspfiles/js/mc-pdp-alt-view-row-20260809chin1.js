(function (window, document) {
  "use strict";

  /* Inline BB-CHINCHILLA photo restore — external fix file 404'd via CF after
     a bad directory upload; keep this self-contained in flash7. */
  try {
    (function fixBbChinchillaPhotos() {
      if (!window || !document || window.__MC_BB_CHINCHILLA_PHOTO_FIX_20260809__) return;
      var path = String((window.location && window.location.pathname) || "");
      var code = "";
      try {
        code = String(
          window.global_Current_ProductCode ||
            ((document.querySelector('input[name="ProductCode"],input[name="productcode"]') || {}).value) ||
            ""
        );
      } catch (eCode) {}
      if (!/bb-chinchilla/i.test(path) && !/BB-CHINCHILLA/i.test(code)) return;
      window.__MC_BB_CHINCHILLA_PHOTO_FIX_20260809__ = true;
      var VER = "20260809chin1";
      var HERO = "/v/vspfiles/photos/BB-CHINCHILLA-1.jpg?v=" + VER;
      var ALT1 = HERO;
      var ALT2 = "/v/vspfiles/photos/BB-CHINCHILLA-2.jpg?v=" + VER;
      function setSrc(el, url) {
        if (!el || !url) return;
        try {
          if (el.removeAttribute) el.removeAttribute("srcset");
          if (el.setAttribute) el.setAttribute("src", url);
          if ("src" in el) el.src = url;
        } catch (eSet) {}
      }
      function setHref(el, url) {
        if (!el || !url) return;
        try {
          if (el.setAttribute) el.setAttribute("href", url);
          if ("href" in el) el.href = url;
        } catch (eHref) {}
      }
      function apply() {
        var hero = document.getElementById("product_photo");
        if (hero) setSrc(hero, HERO);
        document.querySelectorAll("#product_photo_zoom_url, #product_photo_zoom_url2").forEach(function (a) {
          setHref(a, HERO);
        });
        document
          .querySelectorAll("#mc-pdp-alt-view-row a, #mc-pdp-alt-view-row-host a, .mc-pdp-alt-view-row a, #altviews a")
          .forEach(function (a) {
            var href = String(a.getAttribute("href") || a.href || "");
            var img = a.querySelector("img");
            var src = img ? String(img.getAttribute("src") || img.src || "") : href;
            if (!/chinchilla/i.test(href + " " + src) && !img) return;
            if (/[-_]2(?:T)?\.(?:jpg|jpeg|png|webp)/i.test(src) || /[-_]2(?:T)?\.(?:jpg|jpeg|png|webp)/i.test(href)) {
              setHref(a, ALT2);
              if (img) setSrc(img, ALT2);
            } else {
              setHref(a, ALT1);
              if (img) setSrc(img, ALT1);
            }
          });
      }
      apply();
      [0, 150, 400, 900, 1600, 3000, 6000].forEach(function (ms) {
        window.setTimeout(apply, ms);
      });
    })();
  } catch (eChinBoot) {}


  /* MC_ALT_VIEW_ROW_DUPLICATE_GUARD_20260727: clear the "pending" marker that
     either loader (mc-pdp-auth-cta-fix.js's ensureFreshSaranoniAltViewRowScript,
     or mc-plp-enforcer.js's upgradeAltViewRow) sets on the <script> tag the
     instant it's inserted — BEFORE the guard check below, so it's cleared
     whether this particular execution turns out to be the real run or an
     already-guarded-out duplicate. Confirmed live: two separate instances of
     this file were executing simultaneously and fighting over
     #mc-pdp-alt-view-row's data-mc-items attribute, causing continuous
     rebuild/flashing on Saranoni PDPs. */
  try {
    if (window.document && window.document.currentScript) {
      window.document.currentScript.removeAttribute("data-mc-alt-view-row-pending");
    }
  } catch (ePendingClear) {}

  /* MC_ALT_VIEW_ROW_20260801arrow1 tmhprobe1 — Mahjong: probe through a bounded
     window instead of firing every slot at once (see probeSlotWindow below).
     MC_ALT_VIEW_ROW_20260729racefix1 — Saranoni/Mahjong: don't anchor the
     row/host in the legacy pre-unified media td when this script wins the
     load race against mc-pdp-auth-cta-fix.js's DOM restructuring (see
     mediaCellLooksProvisional() / the deferral in render() below). Fixes
     scroll arrows rendering up by the brand logo instead of the thumbnail
     strip (sar-wfl-knt-tod.htm, 2026-07-29).
     MC_ALT_VIEW_ROW_20260728altfix2 — Fortuna/Olsen/Zenith:
     - Probe numbered -N.jpg when -altviewN is missing/sparse (Fortuna row vanished)
     - Don't hide an already-built row while a re-probe briefly returns empty
     - Don't let a single bad altview suppress good numbered photos
     - Deny known wrong-color/wrong-SKU altview sets (Zenith beige on dark SKU) */
  if (!window || !document) return;
  /* First script tag wins. Parallel loaders (plp + stub flash4 + baked tmhnum4)
     used to race the owned check and both boot — double probe/rebuild = flash. */
  var ROW_VERSION = 202608091;
  /* Newer builds may replace an older owner (stale plp/impl inject that raced
     ahead of the flash7 stub). Equal/newer locks still short-circuit. */
  if (
    (window.__MC_ALT_VIEW_ROW_LOCK__ || window.__MC_ALT_VIEW_ROW_OWNED__) &&
    (Number(window.__MC_ALT_VIEW_ROW_VER__ || 0) || 0) >= ROW_VERSION
  ) {
    return;
  }
  window.__MC_ALT_VIEW_ROW_LOCK__ = true;
  window.__MC_ALT_VIEW_ROW_VER__ = ROW_VERSION;
  window.__MC_ALT_VIEW_ROW_OWNED__ = true;
  /* Exhaust the legacy FB double-pass so a stale cached copy (tmhnum4) that
     still allows one extra fbcheckout run cannot start a second owner and
     paint mojibake scroll arrows over the stable rail. */
  window.__MC_TMH_ALT_VIEW_ROW_FB_PASSES__ = 99;
  var rowGen = (window.__MC_ALT_VIEW_ROW_GEN__ = (Number(window.__MC_ALT_VIEW_ROW_GEN__ || 0) || 0) + 1);
  function isRowOwner() {
    return rowGen === window.__MC_ALT_VIEW_ROW_GEN__;
  }
  /* flash7: latch Saranoni rail after first settled probe — a stale CF loader
     was still painting a sparse 8-thumb list while flash6 painted 20, and the
     product-parent MutationObserver re-scheduled forever (Wearable Blanket
     hit 1000+ rebuilds). */
  window.__MC_TMH_ALT_VIEW_ROW_20260803flash7__ = true;
  /* flash6: mark rail ready only after Saranoni probe settles — early CSS keeps
     the host invisible until then so CF-cached plp/tmhnum4 mid-probe paints
     cannot flash (Peter Rabbit muslin). */
  window.__MC_TMH_ALT_VIEW_ROW_20260802flash6__ = true;
  /* flash5: do not paint Saranoni thumbs until the probe pass finishes —
     schedule()/MO used to render partial discovered lists and rebuild the
     strip as each -altviewN hit (visible flashing on Peter Rabbit). */
  window.__MC_TMH_ALT_VIEW_ROW_20260802flash5__ = true;
  /* flash4: kill inherited transition:all + stop display-toggling the active
     thumb (both looked like continuous alt-row flashing on Saranoni). */
  window.__MC_TMH_ALT_VIEW_ROW_20260802flash4__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260802flash3__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260802flash2__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260802flash1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260731tmhprobe1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260729racefix1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260728altfix2__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260728altfix1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260727fixflash1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260726audit1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260725baby1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260725alt3__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260725alt2__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260725hum1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260725gat1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260725fix3__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260723altscrl__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260723close1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260723mob1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260721B__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX5__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX4__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX3__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX1__ = true;
  window.__MC_TMH_ALT_VIEW_ROW_20260716__ = true;

  var ROW_ID = "mc-pdp-alt-view-row";
  var TRACK_CLASS = "mc-pdp-alt-view-row__track";
  var MAX_ALT_VIEWS = 64;
  var MAX_SS_ALT_VIEWS = 8;
  var MAX_NUMBERED_FALLBACK = 8;
  /* MC_ALT_VIEW_IMAGE_CACHE_BUST_20260729: this string is the query-string cache
     key for every probed altview/numbered image (see probeGenericAltViews /
     probeAltViews below) — unlike the script's own load URL, these image probes
     have no per-request timestamp busting, so a stale cached response (e.g. the
     OLD SS-OLSEN-DOVE-PWR-RECL-altview1.jpg, a mismatched sectional photo, before
     today's real recliner photos replace it) can keep being served from cache
     under this exact URL even after the origin file is replaced. Bumping this
     string on every deploy that touches vspfiles/photos forces a fresh fetch.
     Bumped today for the Olsen Dove recliner photo replacement. */
  var ALT_PROBE_VER = "20260809chin1";
  /* MC_ALT_VIEW_PROBE_WINDOW_20260731: max probes in flight at once, and the
     safety-net timeout used for those windowed probes. See probeSlotWindow. */
  var PROBE_WINDOW = 4;
  var WINDOWED_PROBE_TIMEOUT = 12000;
  /* Share probe results across duplicate script tags so a second copy cannot
     re-probe and rebuild the rail from an empty map. */
  var discoveredByCode = window.__MC_ALT_VIEW_DISCOVERED__ || (window.__MC_ALT_VIEW_DISCOVERED__ = {});
  var probeInFlight = {};
  var stickyHeroTimer = null;
  var altRowMutating = false;
  var firstRenderAttemptAt = 0;
  /* flash7: once a Saranoni code has a settled gallery, never let schedule/MO
     or a stale sibling script swap in a shorter signature. */
  var saranoniLatch = window.__MC_ALT_VIEW_SAR_LATCH__ || (window.__MC_ALT_VIEW_SAR_LATCH__ = {});
  var saranoniObserver = null;
  var saranoniLatchRestoreTimer = null;

  /* Known bad CDN altview assets (wrong color / wrong SKU). Keep hero; hide these.
     Olsen Dove recliner altviews were replaced with real recliner angles (2026-07-28). */
  var BAD_ALTVIEW_PATTERNS = {
    "SS-ZENITH-PWR-RECL": /-altview\d+\./i,
    "SS-ZENITH-PWR-CONSOLE-LOVE": /-altview\d+\./i,
    "SS-ZENITH-PWR-CONSOLE-SOFA": /-altview\d+\./i,
    "SS-OLSEN-DOVE-PWR-SECT": /-altview1\./i,
    "MOLLY-OLSON-DINING-SET": /-(?:altview1|altview9)\./i
  };

  /* Closeout dining/bar sets where legacy -N.jpg is often unrelated supplier junk. */
  var ALTVIEW_ONLY_CODES = {
    "TYLER-BAR-SET": true,
    "BURLINGTON-DINING-SET": true,
    "CANOVA-DINING-SET": true,
    "MOLLY-OLSON-DINING-SET": true,
    "RAMONA-DINING-SET": true,
    "GRAYSON-DINING-SET": true,
    "ADELINE-PATIO-SET": true
  };

  function isSteveSilverCode(code) {
    return /^SS-/.test(String(code || ""));
  }

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

  /* Facebook/Instagram checkout renders the same Volusion PDP with ?fbcheckout=1
     and hides the native Volusion thumbnail rail. Everything gated on this must
     stay gated — regular storefront PDPs must behave exactly as before.
     flash7 regress: this flag was referenced but never declared, so strict-mode
     render() threw ReferenceError on every TMH page (incl. ?fbcheckout=1) and
     the alt-view row never mounted (Pale Violet Oprah, 2026-08-03). */
  var mcFbCheckout = false;
  try {
    mcFbCheckout = /(?:^|[?&])fbcheckout=1(?:&|$)/i.test(String(window.location.search || ""));
  } catch (eFbFlag) {}
  function isFacebookCheckoutPage() {
    return mcFbCheckout;
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

  /* MC_ALT_VIEW_ROW_MEDIA_CELL_RACE_FIX_20260729: true when mediaCellFor()
     only matched via its last-resort hero.closest("td") fallback — meaning
     mc-pdp-auth-cta-fix.js hasn't tagged the real unified media column
     (td.mc-pdp-media-td / td.mc-unified-pdp-media) yet. On Saranoni/Mahjong
     PDPs that raw fallback td is a small legacy cell (holds only the tiny
     manufacturer-logo image and the hidden zoom-source photo) that cta-fix.js
     later repositions as part of its 2-column grid rebuild — it is NOT the
     visible left media column. Confirmed live on sar-wfl-knt-tod.htm: a stale
     Cloudflare-cached copy of mc-plp-enforcer.js (serving pre-2026-07-27
     content under the ?v=20260716freeship1 template tag) independently loads
     this script the instant #v65-product-parent exists, well before cta-fix.js
     finishes tagging the media column — so the row/host built here anchors to
     that small legacy cell and its scroll arrows end up floating near the
     brand logo at the top of the page instead of by the actual thumbnail
     strip. The stale template tag is being removed separately, but this
     script must not depend on winning that timing race to place itself
     correctly — see the deferral in render() below. */
  function mediaCellLooksProvisional(mediaCell) {
    return (
      !!mediaCell &&
      !mediaCell.classList.contains("mc-pdp-media-td") &&
      !mediaCell.classList.contains("mc-unified-pdp-media") &&
      mediaCell.id !== "product_photo_td"
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

  function probeImage(src, onload, onerror, timeoutMs) {
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
    /* MC_ALT_VIEW_SLOW_LOAD_FIX_20260729: this is a safety net for the rare case
       where an ad/tracker blocker silently drops the request (neither onload nor
       onerror ever fires) — a real load or a real 404 both settle in well under a
       second in normal conditions. 8000ms let a handful of stuck probes stack up
       to a ~19s visible delay before the alt-view row appeared (confirmed live on
       sar-hp-hp-msln-nrs.htm — row render was gated on the last of many parallel
       probes settling near the 8-10s ceiling). Shortened to 3000ms: still far
       longer than any real response needs, but caps the pathological case much
       tighter.
       MC_ALT_VIEW_PROBE_WINDOW_20260731: "well under a second" only holds while
       few probes are in flight. Callers that queue many slots pass a longer
       timeoutMs, because a queued-but-healthy request can sit far past 3000ms
       waiting on a connection and must not be misread as a missing file. */
    setTimeout(handleError, timeoutMs || 3000);
    return tester;
  }

  /* MC_ALT_VIEW_PROBE_WINDOW_20260731: probe a slot list through a bounded
     window instead of firing every slot at once.
     Mahjong PDPs probe up to MAX_ALT_VIEWS slots, and launching all of them
     together put ~60 image requests behind the browser's ~6-connections-per-host
     limit. That was survivable while Mahjong alt views were small, but once the
     galleries were re-cut as full-size JPEGs (57-300 KB each) every probe's
     wall-clock time crossed probeImage's 3000ms safety net, so slots that really
     returned HTTP 200 were all recorded as misses, discoveredByCode stayed
     empty, and no alt-view row was ever built. Confirmed live on
     tmh-trv-butter-yellow-set.htm: -altview1..5 each served 200 but took 8-9s
     because of queueing, while the timeout fired at 3s.
     Keeping only PROBE_WINDOW requests in flight puts each probe's latency back
     near its real response time; stopAfterMisses ends the scan once a run of
     slots is absent, so a full 64-slot walk is no longer the normal case. */
  function probeSlotWindow(options) {
    var slots = options.slots || [];
    var concurrency = options.concurrency || PROBE_WINDOW;
    var stopAfterMisses = options.stopAfterMisses || 0;
    var timeoutMs = options.timeoutMs || WINDOWED_PROBE_TIMEOUT;
    var onHit = options.onHit;
    var onDone = options.onDone;
    var nextIndex = 0;
    var inFlight = 0;
    var hits = 0;
    var consecutiveMisses = 0;
    var stopped = false;
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      if (onDone) onDone(hits);
    }

    function pump() {
      if (finished) return;
      while (!stopped && inFlight < concurrency && nextIndex < slots.length) {
        var entry = slots[nextIndex];
        nextIndex += 1;
        inFlight += 1;
        (function (slotEntry) {
          probeImage(
            slotEntry.src,
            function () {
              inFlight -= 1;
              hits += 1;
              consecutiveMisses = 0;
              if (onHit) onHit(slotEntry);
              pump();
            },
            function () {
              inFlight -= 1;
              consecutiveMisses += 1;
              /* Only give up early once something real was found — a product
                 whose first slots are absent may still have none at all, and
                 404s are cheap enough to finish the walk. */
              if (stopAfterMisses && hits && consecutiveMisses >= stopAfterMisses) stopped = true;
              pump();
            },
            timeoutMs
          );
        })(entry);
      }
      if (inFlight === 0 && (stopped || nextIndex >= slots.length)) finish();
    }

    if (!slots.length) {
      finish();
      return;
    }
    pump();
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

  function isAltviewUrl(url) {
    return /-altview\d+\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(String(url || ""));
  }

  function isNumberedUrl(url) {
    return /-\d+T?\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(String(url || "")) && !isAltviewUrl(url);
  }

  function isTinyOrThumbUrl(url) {
    return /-\d+T\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(String(url || ""));
  }

  function dropBadAltviews(code, items) {
    var pat = BAD_ALTVIEW_PATTERNS[String(code || "").toUpperCase()];
    if (!pat) return items;
    return items.filter(function (item) {
      return !pat.test(item.full || "");
    });
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
    items = dropBadAltviews(code, items);

    var altItems = items.filter(function (item) { return isAltviewUrl(item.full); });
    var numItems = items.filter(function (item) {
      return isNumberedUrl(item.full) && !isTinyOrThumbUrl(item.full);
    });

    /* Prefer a real altview gallery (2+) when present. A single altview is often
       a mismatched supplier leftover (Olsen Dove recliner → sectional piece).
       When altviews are sparse/missing, keep numbered -N.jpg so the row does
       not vanish (Fortuna). Closeout dining/bar codes stay altview-only when
       they have 2+ good altviews — their legacy -N slots are frequently wrong. */
    if (altItems.length >= 2) {
      if (ALTVIEW_ONLY_CODES[String(code || "").toUpperCase()] || !numItems.length) {
        items = altItems;
      } else if (isSteveSilverCode(code)) {
        /* SS living pieces: merge numbered after altviews, skip hero duplicate -1
           when it matches the forced SS hero. */
        items = altItems.concat(numItems);
      } else {
        items = altItems;
      }
    } else if (altItems.length === 1 && numItems.length) {
      items = numItems;
    } else if (!altItems.length && numItems.length) {
      items = numItems;
    } else {
      items = altItems.concat(numItems);
    }

    /* Deduplicate again after merge; drop the current hero so the row only
       shows true alternate angles (avoids a lone -1 thumb that matches hero). */
    var hero = heroImage();
    var heroCanon = canonicalUrl(
      (hero && (hero.currentSrc || hero.getAttribute("src"))) || ""
    );
    var out = [];
    var seenOut = {};
    items.forEach(function (item) {
      var key = canonicalUrl(item.full);
      if (!key || seenOut[key]) return;
      if (heroCanon && key === heroCanon) return;
      /* Also treat -1.jpg / -1T.jpg as hero-equivalent for SS forced heroes. */
      if (
        heroCanon &&
        /-\d+T?\.(?:jpe?g|png|webp)$/i.test(heroCanon) &&
        /-\d+T?\.(?:jpe?g|png|webp)$/i.test(key)
      ) {
        var heroBase = heroCanon.replace(/-\d+T?\.(?:jpe?g|png|webp)$/i, "");
        var itemBase = key.replace(/-\d+T?\.(?:jpe?g|png|webp)$/i, "");
        var heroSlot = (heroCanon.match(/-(\d+)T?\./i) || [])[1];
        var itemSlot = (key.match(/-(\d+)T?\./i) || [])[1];
        if (heroBase === itemBase && heroSlot && itemSlot && heroSlot === itemSlot) return;
      }
      seenOut[key] = true;
      out.push(item);
    });
    return out;
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
    /* Size chips are owned by mc-pdp-auth-cta-form.js. Their data-main-image is
       often a missing size-only file (Baby Bamboni Lite Sets 1479/1483/1484),
       and holdHero would pin the main photo to a blue "?" for 10s. */
    if (target.closest(".mc-saranoni-size-thumb, #mc-saranoni-size-thumbs, #mc-saranoni-size-label")) {
      return "";
    }
    var btn = target.closest(
      ".mc-configured-color-swatch,.mc-saranoni-color-picker__thumbs a,[data-main-image]"
    );
    if (!btn) return "";
    if (btn.classList && btn.classList.contains("mc-saranoni-size-thumb")) return "";
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

    var slots = [];
    for (var slot = 1; slot <= MAX_ALT_VIEWS; slot += 1) {
      slots.push({
        slot: slot,
        src: "/v/vspfiles/photos/" + code + "-altview" + slot + ".jpg?v=" + ALT_PROBE_VER
      });
    }

    probeSlotWindow({
      slots: slots,
      stopAfterMisses: 4,
      onHit: function (entry) {
        discoveredByCode[code].push({
          slot: entry.slot,
          full: entry.src,
          alt: "Alternate product view " + entry.slot
        });
      },
      /* MC_ALT_VIEW_NO_PARTIAL_RENDER_20260727: render exactly once, when the
         whole scan has settled. Rendering per-slot tore the row down (renderRow's
         row.removeChild loop) and rebuilt it on every image that finished
         loading, which visitors saw as repeated flashing. */
      onDone: function () {
        probeInFlight[code] = false;
        discoveredByCode[code].sort(function (a, b) { return a.slot - b.slot; });
        render();
      }
    });
  }

  /* Mahjong House also carries numbered full-size photos ({CODE}-2.jpg, -3.jpg,
     ...) alongside the -altviewN convention. Only used on Facebook checkout,
     where the native Volusion thumbnail rail is intentionally hidden. */
  function probeMahjongNumberedViews(code) {
    if (!code || probeInFlight[code] || discoveredByCode[code]) return;
    probeInFlight[code] = true;
    discoveredByCode[code] = [];

    var slots = [];
    for (var slot = 2; slot <= 16; slot += 1) {
      slots.push({
        slot: slot,
        src: "/v/vspfiles/photos/" + code + "-" + slot + ".jpg?v=" + ALT_PROBE_VER
      });
    }

    probeSlotWindow({
      slots: slots,
      stopAfterMisses: 4,
      onHit: function (entry) {
        discoveredByCode[code].push({
          slot: entry.slot,
          full: entry.src,
          alt: "Alternate product view " + (entry.slot - 1)
        });
      },
      onDone: function (hits) {
        probeInFlight[code] = false;
        if (!hits) {
          /* No numbered gallery for this set — release the latch so the regular
             -altviewN scan can still populate the rail. */
          delete discoveredByCode[code];
          probeAltViews(code);
          return;
        }
        discoveredByCode[code].sort(function (a, b) { return a.slot - b.slot; });
        render();
      }
    });
  }

  function probeGenericAltViews(code) {
    if (!code || probeInFlight[code] || discoveredByCode[code]) return;
    probeInFlight[code] = true;
    discoveredByCode[code] = [];
    /* Probe -altviewN first. If fewer than 2 hit, also probe numbered -N.jpg
       (non-thumb) so products like Fortuna that only have Volusion numbered
       gallery slots still get an alt row. */
    var maxAlt = isSteveSilverCode(code) ? MAX_SS_ALT_VIEWS : Math.min(MAX_ALT_VIEWS, 16);
    var maxNum = MAX_NUMBERED_FALLBACK;
    var altRemaining = maxAlt;
    var numRemaining = 0;
    var consecutiveMisses = 0;
    var stoppedEarly = false;
    var altWaveDone = false;
    var numberedStarted = false;

    function finish() {
      if (stoppedEarly) return;
      stoppedEarly = true;
      probeInFlight[code] = false;
      discoveredByCode[code].sort(function (a, b) { return a.slot - b.slot; });
      render();
    }

    function addDiscovered(slot, src, labelPrefix) {
      var already = discoveredByCode[code].some(function (item) {
        return item.slot === slot || canonicalUrl(item.full) === canonicalUrl(src);
      });
      if (already) return;
      discoveredByCode[code].push({
        slot: slot,
        full: src,
        alt: labelPrefix + " " + slot
      });
    }

    function startNumberedFallback() {
      if (numberedStarted || stoppedEarly) return;
      numberedStarted = true;
      numRemaining = maxNum;
      consecutiveMisses = 0;
      for (var n = 1; n <= maxNum; n += 1) {
        (function (photoSlot) {
          var src =
            "/v/vspfiles/photos/" +
            code +
            "-" +
            photoSlot +
            ".jpg?v=" +
            ALT_PROBE_VER;
          probeImage(
            src,
            function () {
              addDiscovered(100 + photoSlot, src, "Product view");
              completeNum(true);
            },
            function () {
              completeNum(false);
            }
          );
        })(n);
      }
    }

    function completeNum(hit) {
      if (stoppedEarly) return;
      if (hit) consecutiveMisses = 0;
      else consecutiveMisses += 1;
      numRemaining -= 1;
      if (
        isSteveSilverCode(code) &&
        (consecutiveMisses >= 3 ||
          (discoveredByCode[code].some(function (item) {
            return isNumberedUrl(item.full);
          }) &&
            consecutiveMisses >= 2))
      ) {
        finish();
        return;
      }
      if (numRemaining <= 0) finish();
    }

    function completeAlt(hit) {
      if (stoppedEarly || altWaveDone) return;
      if (hit) consecutiveMisses = 0;
      else consecutiveMisses += 1;
      altRemaining -= 1;
      var shouldEnd =
        altRemaining <= 0 ||
        (isSteveSilverCode(code) &&
          (consecutiveMisses >= 3 ||
            (discoveredByCode[code].length && consecutiveMisses >= 2)));
      if (!shouldEnd) return;
      altWaveDone = true;
      var altHits = discoveredByCode[code].filter(function (item) {
        return isAltviewUrl(item.full);
      }).length;
      if (altHits < 2 && !ALTVIEW_ONLY_CODES[String(code || "").toUpperCase()]) {
        startNumberedFallback();
        return;
      }
      finish();
    }

    for (var altSlot = 1; altSlot <= maxAlt; altSlot += 1) {
      (function (photoSlot) {
        var src =
          "/v/vspfiles/photos/" +
          code +
          "-altview" +
          photoSlot +
          ".jpg?v=" +
          ALT_PROBE_VER;
        probeImage(
          src,
          function () {
            addDiscovered(photoSlot, src, "Alternate product view");
            completeAlt(true);
          },
          function () {
            completeAlt(false);
          }
        );
      })(altSlot);
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
      }
      return;
    }
    list.push({
      slot: slot,
      full: src,
      alt: "Alternate product view " + slot
    });
  }

  function probeSaranoniAltViews(code) {
    if (!code || probeInFlight[code]) return;
    /* Allow re-probe when a prior pass latched empty (CDN race / blocked imgs). */
    if (saranoniProbeDone[code] && (discoveredByCode[code] || []).length) return;
    if (!discoveredByCode[code]) discoveredByCode[code] = [];
    probeInFlight[code] = true;

    /* MC_ALT_VIEW_SAR_WINDOW_20260802: previously all 24 slots fired at once.
       Fast 404s on high slots tripped consecutiveMisses>=5 while slots 2–14
       were still loading, finish() latched one thumb, and late hits were
       dropped — Peter Rabbit muslin showed a single alt. Probe in slot order
       with a small window (same helper as Mahjong) so stopAfterMisses means
       "past the end of the gallery", not "random parallel 404s". */
    var slots = [];
    for (var altSlot = 1; altSlot <= MAX_SAR_ALT_SLOT; altSlot += 1) {
      slots.push({
        slot: altSlot,
        src: "/v/vspfiles/photos/" + code + "-altview" + altSlot + ".jpg"
      });
    }

    probeSlotWindow({
      slots: slots,
      concurrency: PROBE_WINDOW,
      stopAfterMisses: 5,
      timeoutMs: WINDOWED_PROBE_TIMEOUT,
      onHit: function (entry) {
        addSaranoniDiscovered(code, entry.slot, entry.src);
      },
      onDone: function () {
        probeInFlight[code] = false;
        saranoniProbeDone[code] = true;
        discoveredByCode[code].sort(function (a, b) { return a.slot - b.slot; });
        if (!(discoveredByCode[code] || []).length) {
          saranoniProbeDone[code] = false;
        }
        render();
      }
    });
  }

  function suppressNativeAltviews(row) {
    var nativeAlt = nativeAltContainer();
    if (!nativeAlt || nativeAlt.id === ROW_ID || (row && nativeAlt.contains(row))) return;
    nativeAlt.style.setProperty("display", "none", "important");
    nativeAlt.style.setProperty("visibility", "hidden", "important");
    nativeAlt.style.setProperty("height", "0", "important");
    nativeAlt.style.setProperty("max-height", "0", "important");
    nativeAlt.style.setProperty("overflow", "hidden", "important");
    nativeAlt.style.setProperty("margin", "0", "important");
    nativeAlt.style.setProperty("padding", "0", "important");
    nativeAlt.style.setProperty("left", "-9999px", "important");
    nativeAlt.setAttribute("data-mc-altviews-suppressed", "1");
    try {
      if (document.body) document.body.classList.add("mc-pdp-custom-alt-row");
    } catch (eCls) {}
  }

  function render() {
    if (!isRowOwner()) return;
    var code = productCode();
    var isSaranoni = isSaranoniProductPage(code);
    var isMahjong = isMahjongProductPage(code);
    var isGenericPdp = isAnyProductPage() && !!code && !isSaranoni && !isMahjong;
    if (!isMahjong && !isSaranoni && !isGenericPdp) return;
    /* Hide native #altviews immediately on Saranoni — before probes finish —
       so CTA numbered-restore cannot flash a second rail during load. */
    if (isSaranoni) suppressNativeAltviews(document.getElementById(ROW_ID));
    /* Facebook checkout must build the numbered Mahjong rail even when Volusion
       emitted a partial native #altviews container — in that case collectItems()
       returns a short list, so the empty-list probe further down never runs.
       Wait for that probe before painting native/partial thumbs — progressive
       collectItems() signatures were rebuilding the row as each image arrived. */
    if (isMahjong && isFacebookCheckoutPage()) {
      if (probeInFlight[code]) return;
      if (!Object.prototype.hasOwnProperty.call(discoveredByCode, code)) {
        probeMahjongNumberedViews(code);
        return;
      }
    }
    var hero = heroImage();
    var mediaCell = mediaCellFor(hero);
    if (!hero || !mediaCell) return;
    if (!firstRenderAttemptAt) firstRenderAttemptAt = Date.now();

    var row = document.getElementById(ROW_ID);

    /* MC_ALT_VIEW_ROW_MEDIA_CELL_RACE_FIX_20260729: don't create the row/host
       for the first time in a provisional (not-yet-unified) media cell on
       Saranoni/Mahjong PDPs — wait for mc-pdp-auth-cta-fix.js to tag the real
       media column, retrying via the existing schedule()/MutationObserver
       machinery below. Once the row already exists, keep going through the
       normal path (renderRow's own re-home logic in the "else" branch still
       relocates it if a better mediaCell shows up later). Fails open after
       8s so pages that never get the unified classes behave exactly as
       before.
       Saranoni only: Mahjong House PDPs never receive the unified media-cell
       classes at all (their hero sits in an untagged nested-table td), so for
       them this deferral could never be satisfied and only cost every visitor
       the full 8s wait before any alt-view row could be built. */
    if (
      !row &&
      isSaranoni &&
      mediaCellLooksProvisional(mediaCell) &&
      Date.now() - firstRenderAttemptAt < 8000
    ) {
      return;
    }

    if (isSaranoni) {
      /* MC_ALT_VIEW_STABLE_SIGNATURE_20260727: sarItems used to be filtered by
         comparing each item's URL against the hero's CURRENT src, and that
         filtered list fed straight into renderRow's rebuild signature. The
         Saranoni hero src is actively re-asserted by a separate enforcement
         interval in mc-pdp-auth-cta-fix.js (enforceConfiguredColorPhoto, every
         120ms) — any time that interval's target value didn't exactly match
         what was already showing, the hero src flipped, heroCanon changed,
         the filtered item list changed, the signature changed, and renderRow
         tore the whole thumbnail row down and rebuilt it — visible as
         continuous flashing of the entire row, not just a one-time render.
         Fix: build the row from the full discovered list (stable — depends
         only on what's been probed, never on the hero's current src), then
         separately sync which thumbnail is "active" via a lightweight
         style toggle below that never touches the row's signature. */
      var heroCanon = canonicalUrl(hero.currentSrc || hero.getAttribute("src") || "");
      var latched = saranoniLatch[code];
      if (latched && latched.items && latched.items.length) {
        suppressNativeAltviews(row);
        if (!row || row.getAttribute("data-mc-items") !== latched.signature) {
          renderRow(hero, mediaCell, row, latched.items);
        }
        syncActiveSaranoniThumb(heroCanon);
        markAltRowReady();
        return;
      }
      var sarItems = (discoveredByCode[code] || [])
        .slice()
        .sort(function (a, b) { return a.slot - b.slot; });
      /* flash5: never paint while the windowed probe is in flight. schedule()/MO
         used to render partial discovered lists and rebuild as each -altviewN hit. */
      if (probeInFlight[code]) {
        if (!(row && row.querySelector("." + TRACK_CLASS))) {
          if (row) row.style.setProperty("display", "none", "important");
        } else if (sarItems.length) {
          syncActiveSaranoniThumb(heroCanon);
        }
        return;
      }
      if (!sarItems.length) {
        if (!(row && row.children && row.children.length)) {
          if (row) row.style.setProperty("display", "none", "important");
        }
        probeSaranoniAltViews(code);
        return;
      }
      suppressNativeAltviews(row);
      renderRow(hero, mediaCell, row, sarItems);
      syncActiveSaranoniThumb(heroCanon);
      markAltRowReady();
      /* flash7: latch only after the ordered probe finished — never freeze a
         mid-probe partial list (that was the Wearable 8↔20 thrash). */
      if (saranoniProbeDone[code] && sarItems.length >= 2) {
        saranoniLatch[code] = {
          signature: sarItems.map(function (item) { return canonicalUrl(item.full); }).join("|"),
          items: sarItems
        };
        try {
          if (saranoniObserver) {
            saranoniObserver.disconnect();
            saranoniObserver = null;
          }
        } catch (eObsOff) {}
        if (!saranoniLatchRestoreTimer) {
          saranoniLatchRestoreTimer = window.setInterval(function () {
            if (!isRowOwner()) return;
            var latchCode = productCode();
            var latch = saranoniLatch[latchCode];
            if (!latch || !latch.items || !latch.items.length) return;
            var liveRow = document.getElementById(ROW_ID);
            if (!liveRow) return;
            if (liveRow.getAttribute("data-mc-items") === latch.signature) return;
            var liveHero = heroImage();
            var liveCell = mediaCellFor(liveHero);
            if (!liveHero || !liveCell) return;
            renderRow(liveHero, liveCell, liveRow, latch.items);
            markAltRowReady();
          }, 250);
        }
      }
      return;
    }

    var items = collectItems(code);
    /* Always probe -altviewN for furniture/closeout PDPs. Native #altviews often
       only exposes the hero (-1/-2T), which previously short-circuited probing and
       left mismatched or missing alt galleries (Canova/Camolson, 2026-07-25). */
    if (
      isGenericPdp &&
      !probeInFlight[code] &&
      !Object.prototype.hasOwnProperty.call(discoveredByCode, code)
    ) {
      probeGenericAltViews(code);
    }
    if (!items.length) {
      /* Fortuna race: native thumbs build the row, then #altviews is suppressed and
         collectItems goes empty mid-probe — hiding wiped a good gallery. Keep the
         existing row visible until a probe finishes with a real list (or never). */
      if (!(row && row.querySelector("." + TRACK_CLASS))) {
        if (row) row.style.setProperty("display", "none", "important");
      }
      if (isMahjong && isFacebookCheckoutPage()) {
        /* Facebook checkout must build the numbered Mahjong rail even when
           Volusion emitted only a partial native #altviews container. */
        probeMahjongNumberedViews(code);
      } else if (isGenericPdp) {
        /* probe already kicked off above */
      } else {
        probeAltViews(code);
      }
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
      /* Strip restored -N thumbs so stale CDN files (wrong product) cannot reappear. */
      try {
        nativeAlt.querySelectorAll("[data-mc-numbered-alt]").forEach(function (node) {
          if (node.parentNode) node.parentNode.removeChild(node);
        });
      } catch (eStrip) {}
      try {
        if (document.body) document.body.classList.add("mc-pdp-custom-alt-row");
      } catch (eCls) {}
    }

    renderRow(hero, mediaCell, row, items);
  }

  /* MC_ALT_VIEW_STABLE_SIGNATURE_20260727: hides whichever thumbnail matches
     the hero's current src, without rebuilding the row. Pure inline-style
     toggle on existing <a> elements — doesn't touch data-mc-items (the
     rebuild signature) and doesn't trigger the row's own childList
     MutationObserver (which only watches childList/subtree, not style/attr
     changes), so this can run every time the hero src is re-checked without
     causing another rebuild. */
  function syncActiveSaranoniThumb(heroCanon) {
    var row = document.getElementById(ROW_ID);
    if (!row) return;
    /* Mark the active thumb in place. Hiding it with display:none reflowed the
       strip (and inherited transition:all animated that reflow) whenever the
       hero src was re-asserted — visible as continuous alt-row flashing. */
    Array.prototype.forEach.call(row.querySelectorAll("a[data-mc-tmh-alt-slot]"), function (link) {
      var isActive = canonicalUrl(link.getAttribute("href") || "") === heroCanon;
      if (isActive) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "true");
        link.style.removeProperty("display");
      } else {
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
        link.style.removeProperty("display");
      }
    });
  }

  /* flash6: reveal only after a settled paint. Early stub CSS keeps
     :not([data-mc-alt-ready="1"]) invisible so stale CF loaders cannot flash. */
  function markAltRowReady() {
    var row = document.getElementById(ROW_ID);
    if (!row || !row.querySelector("." + TRACK_CLASS)) return;
    try {
      row.setAttribute("data-mc-alt-ready", "1");
      var host = document.getElementById("mc-pdp-alt-view-row-host");
      if (host) host.setAttribute("data-mc-alt-ready", "1");
    } catch (eReady) {}
  }

  /* Shared by both the Mahjong (#altviews/-altviewN probe) and Saranoni
     (-2/-2T probe) paths — builds/positions the thumbnail row and wires up
     hero-swap clicks. Nothing here is product-type-specific. */
  function renderRow(hero, mediaCell, row, items) {
    if (!isRowOwner()) return;
    ensureAltRowCss();
    if (!row) {
      /* MC_ALT_VIEW_DEBUG_20260727: temporary diagnostic — logs every time the
         row element didn't exist and had to be created fresh. If this fires
         repeatedly (not just once on initial page load), something else is
         removing #mc-pdp-alt-view-row from the DOM between renders. Safe to
         remove once the flashing root cause is confirmed. */
      try {
        window.__mcAltRowCreateCount = (window.__mcAltRowCreateCount || 0) + 1;
        console.log(
          "[MC-ALT-DEBUG] creating NEW row element (count=" + window.__mcAltRowCreateCount + ")",
          new Error("stack").stack
        );
      } catch (eDbg1) {}
      row = document.createElement("div");
      row.id = ROW_ID;
      row.setAttribute("role", "region");
      row.setAttribute("aria-label", "Alternate product views");
      var heroBlock = directChild(mediaCell, hero);
      if (heroBlock) mediaCell.insertBefore(row, heroBlock.nextSibling || null);
      else mediaCell.appendChild(row);
    } else {
      /* Host wrap is intentional — never yank the row out of the host.
         Moving only the row left empty #mc-pdp-alt-view-row-host nodes stacked
         under the hero (Barron flicker + page growing downward). */
      var parent = row.parentNode;
      var hostEl =
        (parent && parent.id === "mc-pdp-alt-view-row-host" && parent) ||
        document.getElementById("mc-pdp-alt-view-row-host");
      if (hostEl && row.parentNode !== hostEl) {
        try { hostEl.appendChild(row); } catch (eRehost) {}
      }
      if (hostEl) {
        if (!mediaCell.contains(hostEl)) {
          var currentHeroBlock = directChild(mediaCell, hero);
          if (currentHeroBlock) mediaCell.insertBefore(hostEl, currentHeroBlock.nextSibling || null);
          else mediaCell.appendChild(hostEl);
        }
        /* Remove duplicate/orphan hosts left by older builds. */
        Array.prototype.forEach.call(document.querySelectorAll("#mc-pdp-alt-view-row-host"), function (node) {
          if (node !== hostEl && (!node.contains(row))) {
            try { if (node.parentNode) node.parentNode.removeChild(node); } catch (eOrphan) {}
          }
        });
      } else if (parent !== mediaCell) {
        var heroBlock2 = directChild(mediaCell, hero);
        if (heroBlock2) mediaCell.insertBefore(row, heroBlock2.nextSibling || null);
        else mediaCell.appendChild(row);
      }
    }

    var heroWidth = Math.round(hero.getBoundingClientRect().width || hero.offsetWidth || 0);
    /* IMPORTANT: do NOT use display:flex on the scrollport itself. Inside
       Volusion nested table cells, a flex scrollport reports scrollWidth >
       clientWidth but scrollLeft stays locked at 0 (confirmed live on
       Steve Silver closeout). Block host + inline-flex track scrolls. */
    row.style.setProperty("display", "block", "important");
    row.style.setProperty("order", "2", "important");
    var visibleCount = Math.min(items.length, 3);
    var thumbSize = Math.max(
      48,
      Math.min(84, Math.floor((heroWidth - Math.max(visibleCount - 1, 0) * 8) / Math.max(visibleCount, 1)))
    );
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
    row.style.setProperty("scroll-behavior", "auto", "important");
    row.style.setProperty("-webkit-overflow-scrolling", "touch", "important");
    row.style.setProperty("touch-action", "pan-x", "important");
    row.style.setProperty("scrollbar-width", "thin", "important");
    row.style.setProperty("-ms-overflow-style", "auto", "important");

    var signature = items.map(function (item) { return canonicalUrl(item.full); }).join("|");
    if (row.getAttribute("data-mc-items") === signature && row.querySelector("." + TRACK_CLASS)) {
      /* Already built — never rebuild thumbs. Only touch arrows if glyphs are
         still the corrupted U+2039 form from an older instance. */
      var prevBtn = document.querySelector("#mc-pdp-alt-view-row-host .mc-pdp-alt-view-row__arrow--prev");
      if (!prevBtn || prevBtn.textContent !== "<") ensureAltRowScrollArrows(row, mediaCell);
      markAltRowReady();
      return;
    }
    /* MC_ALT_VIEW_DEBUG_20260727: temporary diagnostic — logs every actual
       thumbnail-row rebuild (the removeChild loop below), with the old vs new
       signature and a stack trace. If this fires more than once or twice
       total on a page that never changes color/size, that's the flashing.
       Safe to remove once root cause is confirmed. */
    try {
      window.__mcAltRowRebuildCount = (window.__mcAltRowRebuildCount || 0) + 1;
      console.log(
        "[MC-ALT-DEBUG] REBUILDING row (count=" + window.__mcAltRowRebuildCount + ")",
        "\n  old signature:", row.getAttribute("data-mc-items"),
        "\n  new signature:", signature,
        "\n  stack:", new Error("stack").stack
      );
    } catch (eDbg2) {}
    altRowMutating = true;
    try {
      row.setAttribute("data-mc-items", signature);
      while (row.firstChild) row.removeChild(row.firstChild);

      var track = document.createElement("div");
      track.className = TRACK_CLASS;
      track.style.setProperty("display", "inline-flex", "important");
      track.style.setProperty("flex-wrap", "nowrap", "important");
      track.style.setProperty("align-items", "center", "important");
      track.style.setProperty("justify-content", "flex-start", "important");
      track.style.setProperty("gap", "8px", "important");
      track.style.setProperty("width", "max-content", "important");
      track.style.setProperty("max-width", "none", "important");
      track.style.setProperty("box-sizing", "border-box", "important");

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
        track.appendChild(link);
      });
      row.appendChild(track);
      ensureAltRowScrollArrows(row, mediaCell);
      markAltRowReady();
    } finally {
      window.setTimeout(function () {
        altRowMutating = false;
      }, 0);
    }
  }

  function ensureAltRowScrollArrows(row, mediaCell) {
    if (!row || !row.parentNode) return;
    altRowMutating = true;
    try {
      var host = row.parentNode;
      if (host.id !== "mc-pdp-alt-view-row-host") {
        var wrap = document.createElement("div");
        wrap.id = "mc-pdp-alt-view-row-host";
        wrap.className = "mc-pdp-alt-view-row-host";
        try {
          host.insertBefore(wrap, row);
          wrap.appendChild(row);
        } catch (eWrap) {
          return;
        }
        host = wrap;
      }
      host.style.setProperty("display", "block", "important");
      host.style.setProperty("position", "relative", "important");
      host.style.setProperty("width", row.style.maxWidth || "100%", "important");
      host.style.setProperty("max-width", row.style.maxWidth || "100%", "important");
      host.style.setProperty("margin", "10px auto 0", "important");
      host.style.setProperty("box-sizing", "border-box", "important");
      row.style.setProperty("margin-top", "0", "important");
      row.style.setProperty("display", "block", "important");
      row.style.setProperty("overflow-x", "auto", "important");

      function makeButton(dir) {
        var cls = "mc-pdp-alt-view-row__arrow--" + (dir < 0 ? "prev" : "next");
        var btn = host.querySelector(":scope > ." + cls);
        if (!btn) {
          btn = document.createElement("button");
          btn.type = "button";
          btn.className = "mc-pdp-alt-view-row__arrow " + cls;
          btn.setAttribute("aria-label", dir < 0 ? "Scroll alternate views left" : "Scroll alternate views right");
          if (dir < 0) host.insertBefore(btn, row);
          else host.appendChild(btn);
        }
        /* ASCII only — some Volusion/CDN pipelines corrupt U+2039/U+203A into
           mojibake ("â?¹") that painted over the thumbnail strip. Always
           re-assert so a prior instance's broken glyphs get replaced. */
        btn.textContent = dir < 0 ? "<" : ">";
        btn.onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();
          var amount = Math.max(Math.round((row.clientWidth || 220) * 0.72), 140);
          var before = row.scrollLeft || 0;
          try {
            row.scrollBy({ left: dir * amount, behavior: "smooth" });
          } catch (eScrollBy) {}
          window.setTimeout(function () {
            if (Math.abs((row.scrollLeft || 0) - before) < 2) {
              row.scrollLeft = before + dir * amount;
            }
            refresh();
          }, 40);
        };
        return btn;
      }

      var prev = makeButton(-1);
      var next = makeButton(1);
      function refresh() {
        var max = Math.max(0, row.scrollWidth - row.clientWidth - 2);
        var hasOverflow = max > 4;
        prev.style.setProperty("display", hasOverflow ? "flex" : "none", "important");
        next.style.setProperty("display", hasOverflow ? "flex" : "none", "important");
        prev.disabled = !hasOverflow || row.scrollLeft <= 2;
        next.disabled = !hasOverflow || row.scrollLeft >= max;
      }
      if (row.dataset.mcAltArrowBound !== "1") {
        row.dataset.mcAltArrowBound = "1";
        row.addEventListener("scroll", refresh, { passive: true });
        window.addEventListener("resize", refresh);
      }
      row.dataset.mcAltArrowReady = "1";
      refresh();
      window.setTimeout(refresh, 200);
    } finally {
      window.setTimeout(function () {
        altRowMutating = false;
      }, 0);
    }
  }

  function ensureAltRowCss() {
    var id = "mc-pdp-alt-view-row-css";
    var st = document.getElementById(id);
    if (!st) {
      st = document.createElement("style");
      st.id = id;
      (document.head || document.documentElement).appendChild(st);
    }
    st.textContent =
      "#mc-pdp-alt-view-row-host,#mc-pdp-alt-view-row,#mc-pdp-alt-view-row .mc-pdp-alt-view-row__track," +
      "#mc-pdp-alt-view-row a,#mc-pdp-alt-view-row img{transition:none!important;animation:none!important}" +
      "#mc-pdp-alt-view-row-host:not([data-mc-alt-ready=\"1\"]),#mc-pdp-alt-view-row:not([data-mc-alt-ready=\"1\"]){" +
      "opacity:0!important;visibility:hidden!important;pointer-events:none!important}" +
      "#mc-pdp-alt-view-row-host{display:block!important;position:relative!important;clear:both!important;float:none!important;z-index:1!important;box-sizing:border-box!important}" +
      "#mc-pdp-alt-view-row{display:block!important;position:relative!important;clear:both!important;float:none!important;z-index:1!important;" +
      "overflow-x:auto!important;overflow-y:hidden!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-x!important;" +
      "scrollbar-width:none!important}" +
      "#mc-pdp-alt-view-row .mc-pdp-alt-view-row__track{display:inline-flex!important;flex-wrap:nowrap!important;align-items:center!important;" +
      "gap:8px!important;width:max-content!important;max-width:none!important}" +
      "#mc-pdp-alt-view-row a,#mc-pdp-alt-view-row img{float:none!important;position:relative!important;z-index:1!important}" +
      "#mc-pdp-alt-view-row a.is-active{outline:2px solid #222!important;outline-offset:2px!important}" +
      "#mc-pdp-alt-view-row-host .mc-pdp-alt-view-row__arrow{appearance:none!important;-webkit-appearance:none!important;position:absolute!important;" +
      "top:50%!important;transform:translateY(-50%)!important;z-index:5!important;width:28px!important;height:40px!important;" +
      "border:1px solid #ddd!important;border-radius:999px!important;background:rgba(255,255,255,.96)!important;color:#444!important;" +
      "display:none!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;" +
      "font:700 20px/1 Arial,sans-serif!important;cursor:pointer!important;box-shadow:0 1px 3px rgba(0,0,0,.08)!important}" +
      "#mc-pdp-alt-view-row-host .mc-pdp-alt-view-row__arrow--prev{left:4px!important}" +
      "#mc-pdp-alt-view-row-host .mc-pdp-alt-view-row__arrow--next{right:4px!important}" +
      "#mc-pdp-alt-view-row-host .mc-pdp-alt-view-row__arrow[disabled]{opacity:.25!important;pointer-events:none!important}" +
      "@media (max-width:991px){#mc-pdp-alt-view-row,#mc-pdp-alt-view-row-host{order:2!important;margin-top:10px!important}}" ;
  }

  function schedule() {
    if (!isRowOwner()) return;
    /* flash7: latched Saranoni galleries are done — don't let product-parent
       MO / resize / delayed timers keep re-entering render(). */
    try {
      var latchedCode = productCode();
      if (
        isSaranoniProductPage(latchedCode) &&
        saranoniLatch[latchedCode] &&
        saranoniLatch[latchedCode].items &&
        saranoniLatch[latchedCode].items.length
      ) {
        return;
      }
    } catch (eSchedLatch) {}
    window.clearTimeout(schedule.timer);
    schedule.timer = window.setTimeout(render, 80);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();
  document.addEventListener("click", function (event) {
    if (!isRowOwner()) return;
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
  /* Re-assert ASCII arrows after late stale copies finish their FB pass. */
  [500, 1500, 3000].forEach(function (delay) {
    window.setTimeout(function () {
      if (!isRowOwner()) return;
      var row = document.getElementById(ROW_ID);
      if (!row) return;
      ensureAltRowScrollArrows(row, mediaCellFor(heroImage()) || row.parentNode);
    }, delay);
  });
  /* Keep native #altviews dead while CTA restore onloads try to flex it. */
  [100, 300, 700, 1200, 2000, 3500, 6000].forEach(function (delay) {
    window.setTimeout(function () {
      if (!isRowOwner()) return;
      if (!isSaranoniProductPage(productCode())) return;
      suppressNativeAltviews(document.getElementById(ROW_ID));
    }, delay);
  });
  if (window.MutationObserver) {
    saranoniObserver = new window.MutationObserver(function (mutations) {
      if (!isRowOwner()) return;
      if (altRowMutating) return;
      try {
        var latchCode = productCode();
        if (
          isSaranoniProductPage(latchCode) &&
          saranoniLatch[latchCode] &&
          saranoniLatch[latchCode].items &&
          saranoniLatch[latchCode].items.length
        ) {
          return;
        }
      } catch (eMoLatch) {}
      var i, j, nodes, node, ignore;
      for (i = 0; i < mutations.length; i++) {
        ignore = true;
        nodes = [];
        if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
          for (j = 0; j < mutations[i].addedNodes.length; j++) nodes.push(mutations[i].addedNodes[j]);
        }
        if (mutations[i].removedNodes && mutations[i].removedNodes.length) {
          for (j = 0; j < mutations[i].removedNodes.length; j++) nodes.push(mutations[i].removedNodes[j]);
        }
        if (!nodes.length) {
          node = mutations[i].target;
          if (node && node.id !== "mc-pdp-alt-view-row-host" && node.id !== "mc-pdp-alt-view-row" &&
              !(node.closest && (node.closest("#mc-pdp-alt-view-row-host") || node.closest("#mc-steve-silver-altviews-wrap")))) {
            ignore = false;
          }
        } else {
          for (j = 0; j < nodes.length; j++) {
            node = nodes[j];
            if (!node || node.nodeType !== 1) continue;
            if (node.id === "mc-pdp-alt-view-row-host" || node.id === "mc-pdp-alt-view-row") continue;
            if (node.closest && (node.closest("#mc-pdp-alt-view-row-host") || node.closest("#mc-steve-silver-altviews-wrap"))) continue;
            ignore = false;
            break;
          }
        }
        if (!ignore) {
          schedule();
          return;
        }
      }
    });
    saranoniObserver.observe(document.getElementById("v65-product-parent") || document.body, { childList: true, subtree: true });
  }
})(window, document);
