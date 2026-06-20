/* MC_WINDSOR_HERO_FIX — force windsor-home.mp4 (CDN caches bad windsor.mp4 slideshow). */
(function (g, d) {
  if (!g || !d || g.__MC_WINDSOR_HERO_FIX__) return;
  g.__MC_WINDSOR_HERO_FIX__ = true;

  var SRC =
    "https://www.mccabestheaterandliving.com/v/vspfiles/windsor-home.mp4?v=20260620windsor1";

  function isHome() {
    var p = String(g.location.pathname || "").toLowerCase();
    return (
      p === "/" ||
      p === "/default.asp" ||
      p === "/default.htm" ||
      p === "/default.html" ||
      p === "/index.htm" ||
      p === "/index.html"
    );
  }

  function apply() {
    if (!isHome()) return;
    var v =
      d.querySelector("#slideshow-container video.mc-hero-video-el") ||
      d.querySelector("video.mc-hero-video-el");
    if (!v) return;

    var srcEl = v.querySelector("source");
    var cur = srcEl
      ? String(srcEl.getAttribute("src") || srcEl.src || "")
      : String(v.getAttribute("src") || v.src || "");
    if (cur.indexOf("windsor-home.mp4") === -1 || v.dataset.mcWindsorHomeApplied !== SRC) {
      if (srcEl) srcEl.setAttribute("src", SRC);
      else v.setAttribute("src", SRC);
      try {
        delete v.dataset.mcStartedAtSeven;
      } catch (eDel) {}
      v.dataset.mcWindsorHomeApplied = SRC;
      try {
        v.load();
      } catch (eLoad) {}
    }

    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.classList.remove("is-preloading");
    v.classList.add("is-ready");
    try {
      v.style.setProperty("opacity", "1", "important");
    } catch (eOp) {}

    function seekPlay() {
      try {
        if (!v.dataset.mcStartedAtSeven) {
          v.dataset.mcStartedAtSeven = "1";
          v.currentTime = 7;
        }
        v.play && v.play().catch(function () {});
      } catch (ePlay) {}
    }

    if (v.readyState >= 1) seekPlay();
    else v.addEventListener("loadedmetadata", seekPlay, { once: true });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", apply);
  else apply();
  g.addEventListener("load", apply);
  [250, 1000, 2500, 5000].forEach(function (ms) {
    g.setTimeout(apply, ms);
  });
})(window, document);
