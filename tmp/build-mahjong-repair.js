const fs = require("fs");
const path = require("path");

const transcript = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-erink-OneDrive-Documents-GitHub-mccabe-site/agent-transcripts/6c2caccf-61ca-4dbf-ade3-7b823f122ced/6c2caccf-61ca-4dbf-ade3-7b823f122ced.jsonl"
);

let text = "";
for (const line of fs.readFileSync(transcript, "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  if (obj.role !== "user") continue;
  for (const part of obj.message?.content || []) {
    if (part.type === "text" && part.text.includes("this is the code so edit")) {
      text = part.text;
      const idx = text.indexOf("<style>");
      if (idx >= 0) text = text.slice(idx);
    }
  }
}

text = text.replace(/<\/user_query>\s*$/, "");
text = text.replace("font-weight: 400;ti", "font-weight: 400;");

const replacements = {
  "tile-we.png": "tile-east.png",
  "tile-ws.png": "tile-south.png",
  "tile-ww.png": "tile-west.png",
  "tile-wn.png": "tile-north.png",
  "tile-dr.png": "tile-red.png",
  "tile-dg.png": "tile-green.png",
  "tile-ds.png": "tile-white.png"
};

for (const [from, to] of Object.entries(replacements)) {
  text = text.split(from).join(to);
}

function removeBlock(source, id, tag) {
  const start = source.indexOf(`<${tag} id="${id}">`);
  if (start === -1) return source;
  const end = source.indexOf(`</${tag}>`, start);
  if (end === -1) return source;
  return source.slice(0, start) + source.slice(end + (`</${tag}>`).length);
}

const removeIds = [
  ["mc-mahjong-v10-visual-repair", "style"],
  ["mc-mahjong-v11-critical-fixes", "style"],
  ["mc-mahjong-final-tile-display-fix", "style"],
  ["mc-mahjong-authoritative-tile-fix-20260717", "style"],
  ["mc-mahjong-uniform-tile-size-fix-20260717", "style"],
  ["mc-mahjong-no-selected-size-shift-20260717", "style"],
  ["mc-mahjong-live-uniform-final-20260717", "style"],
  ["mc-mahjong-force-exact-visible-size-20260717", "style"],
  ["mc-mahjong-force-live-assets-and-normalize-20260717", "script"],
  ["mc-mahjong-visible-body-normalizer-20260717", "script"]
];

for (const [id, tag] of removeIds) {
  text = removeBlock(text, id, tag);
}

const repair = `<style id="mc-mahjong-tile-repair-css-v13">
#mc-mahjong-page .mc-live-tile,
#mc-mahjong-page .mc-live-tile:hover,
#mc-mahjong-page .mc-live-tile:focus,
#mc-mahjong-page .mc-live-tile:focus-visible,
#mc-mahjong-page .mc-live-tile:active {
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  -webkit-appearance: none !important;
  appearance: none !important;
}

#mc-mahjong-page .mc-live-tile.is-selected {
  transform: translateY(-11px) !important;
}

#mc-mahjong-page .mc-live-tile img,
#mc-mahjong-page .mc-tile-strip img,
#mc-mahjong-page .mc-key-tile img,
#mc-mahjong-page .mc-example-tiles img,
#mc-mahjong-page .mc-mini-tile-strip img,
#mc-mahjong-page .mc-teacher-tile-strip img,
#mc-mahjong-page .mc-live-missing img {
  display: block !important;
  height: auto !important;
  max-height: none !important;
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  background-color: transparent !important;
  clip-path: none !important;
  -webkit-clip-path: none !important;
  object-fit: contain !important;
  object-position: center bottom !important;
}

#mc-mahjong-page .mc-pattern,
#mc-mahjong-page .mc-pattern-grid,
#mc-mahjong-page .mc-group-example,
#mc-mahjong-page .mc-key-card,
#mc-mahjong-page .mc-key-group,
#mc-mahjong-page .mc-live-trainer {
  overflow: visible !important;
}
</style>

<script id="mc-mahjong-tile-repair-v13">
(function () {
  "use strict";

  var root = document.getElementById("mc-mahjong-page");
  if (!root || root.dataset.mcTileRepairV13 === "1") return;
  root.dataset.mcTileRepairV13 = "1";

  var OUT_W = 750;
  var OUT_H = 1000;

  var ALIASES = {
    "tile-we.png": "tile-east.png",
    "tile-ws.png": "tile-south.png",
    "tile-ww.png": "tile-west.png",
    "tile-wn.png": "tile-north.png",
    "tile-dr.png": "tile-red.png",
    "tile-dg.png": "tile-green.png",
    "tile-ds.png": "tile-white.png"
  };

  function canonicalSrc(src) {
    var out = src || "";
    Object.keys(ALIASES).forEach(function (from) {
      out = out.replace(from, ALIASES[from]);
    });
    return out;
  }

  function isTileImage(img) {
    return !!img &&
      img.tagName === "IMG" &&
      /\\/v\\/vspfiles\\/mahjong\\/tiles\\/tile-/.test(img.getAttribute("src") || "");
  }

  function findVisibleBounds(image) {
    var canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    var imageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
      return null;
    }

    var d = imageData.data;
    var w = canvas.width;
    var h = canvas.height;
    var seen = new Uint8Array(w * h);
    var queueX = new Int32Array(w * h);
    var queueY = new Int32Array(w * h);
    var head = 0;
    var tail = 0;

    function nearBackground(x, y) {
      var p = (y * w + x) * 4;
      var r = d[p];
      var g = d[p + 1];
      var b = d[p + 2];
      var a = d[p + 3];

      if (a < 20) return true;

      var max = Math.max(r, g, b);
      var min = Math.min(r, g, b);

      return r >= 238 && g >= 238 && b >= 238 && (max - min) <= 14;
    }

    function add(x, y) {
      var i = y * w + x;
      if (seen[i] || !nearBackground(x, y)) return;
      seen[i] = 1;
      queueX[tail] = x;
      queueY[tail] = y;
      tail++;
    }

    for (var x = 0; x < w; x++) {
      add(x, 0);
      add(x, h - 1);
    }

    for (var y = 0; y < h; y++) {
      add(0, y);
      add(w - 1, y);
    }

    while (head < tail) {
      var qx = queueX[head];
      var qy = queueY[head];
      head++;

      if (qx > 0) add(qx - 1, qy);
      if (qx < w - 1) add(qx + 1, qy);
      if (qy > 0) add(qx, qy - 1);
      if (qy < h - 1) add(qx, qy + 1);
    }

    var left = w;
    var top = h;
    var right = -1;
    var bottom = -1;

    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var idx = yy * w + xx;
        var p = idx * 4;

        if (!seen[idx] && d[p + 3] > 20) {
          if (xx < left) left = xx;
          if (xx > right) right = xx;
          if (yy < top) top = yy;
          if (yy > bottom) bottom = yy;
        }
      }
    }

    if (right < left || bottom < top) return null;

    return {
      x: left,
      y: top,
      w: right - left + 1,
      h: bottom - top + 1
    };
  }

  function normalizeToDataUri(img, src) {
    var loader = new Image();
    loader.decoding = "async";

    loader.onload = function () {
      var bounds = findVisibleBounds(loader);
      if (!bounds) {
        img.dataset.mcTileRepairState = "done";
        return;
      }

      var output = document.createElement("canvas");
      output.width = OUT_W;
      output.height = OUT_H;

      var outCtx = output.getContext("2d");
      outCtx.clearRect(0, 0, OUT_W, OUT_H);
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = "high";
      outCtx.drawImage(
        loader,
        bounds.x, bounds.y, bounds.w, bounds.h,
        0, 0, OUT_W, OUT_H
      );

      img.dataset.mcTileRepairState = "done";
      img.src = output.toDataURL("image/png");
    };

    loader.onerror = function () {
      img.dataset.mcTileRepairState = "error";
    };

    loader.src = src;
  }

  function processImage(img) {
    if (!isTileImage(img)) return;
    if (img.dataset.mcTileRepairState === "loading" || img.dataset.mcTileRepairState === "done") return;

    var current = img.getAttribute("src") || "";
    var fixed = canonicalSrc(current);

    if (fixed !== current) {
      img.dataset.mcTileRepairState = "";
      img.setAttribute("src", fixed);
      return;
    }

    if (current.indexOf("data:image/") === 0) {
      img.dataset.mcTileRepairState = "done";
      return;
    }

    img.dataset.mcTileRepairState = "loading";
    normalizeToDataUri(img, fixed);
  }

  function scan(scope) {
    if (!scope) return;

    if (scope.nodeType === 1 && scope.tagName === "IMG") {
      processImage(scope);
    }

    if (!scope.querySelectorAll) return;

    Array.prototype.forEach.call(
      scope.querySelectorAll('img[src*="/v/vspfiles/mahjong/tiles/tile-"]'),
      processImage
    );
  }

  scan(root);

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "attributes" && mutation.target.tagName === "IMG") {
        processImage(mutation.target);
      }

      Array.prototype.forEach.call(mutation.addedNodes, function (node) {
        if (node.nodeType === 1) scan(node);
      });
    });
  }).observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"]
  });

  window.addEventListener("load", function () {
    scan(root);
  }, { once: true });
})();
</script>`;

text = text.trim() + "\n\n" + repair + "\n";

const out = path.join(__dirname, "mahjong-trainer-repaired-v13.html");
fs.writeFileSync(out, text, "utf8");
console.log("WROTE", out);
console.log("LEN", text.length);
