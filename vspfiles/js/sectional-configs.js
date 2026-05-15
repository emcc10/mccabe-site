/**
 * Sectional configuration diagram cards — data only.
 * Keys must match Volusion style names (see getStyleFromPage / product codes before "-SC-").
 *
 * Wired collections (each gets Popular-block PNGs when you run export_sectional_diagrams.py --publish):
 *   Alula, Acacia, Atticus, Colebrook, Creighton.
 * Add a new top-level key here + palliser.{Style} in tools/sectional-diagrams/catalog.json, then re-export.
 *
 * If the PDP title uses “Aloira” instead of “Alula”, the renderer maps that page to the Alula config row (same Palliser line).
 * Product Summary PDF: https://images.palliser.com/specsheet/en/77427%20ALULA.pdf
 * Popular configurations on that PDF: 07-15, 07-09-19, 07-09-08, 12-40 (see tools/sectional-diagrams/export_sectional_diagrams.py, 300 DPI).
 *
 * Regenerate PNGs: tools/sectional-diagrams/export_diagrams.ps1
 * Commit + push PNGs to GitHub (main). image URLs use raw.githubusercontent.com so diagrams update without Volusion PNG uploads.
 * Optional: set window.MTL_SECTIONAL_DIAGRAM_BASE before this script (must end with /) to override the host or branch.
 */
(function () {
  var _base =
    typeof window !== "undefined" && window.MTL_SECTIONAL_DIAGRAM_BASE
      ? String(window.MTL_SECTIONAL_DIAGRAM_BASE).trim()
      : "https://raw.githubusercontent.com/emcc10/mccabe-site/main/vspfiles/sectional-diagrams/";
  if (!_base) {
    _base = "https://raw.githubusercontent.com/emcc10/mccabe-site/main/vspfiles/sectional-diagrams/";
  }
  _base = _base.replace(/\/?$/, "/");

  function img(name) {
    return _base + name;
  }

  window.MTL_SECTIONAL_CONFIGS = {
    Alula: [
      {
        code: "07-15",
        label: "07-15",
        configurationTitle: "3-Seat Chaise Sectional",
        description: "",
        priceDiff: 0,
        image: img("Alula-SC-07-15.png"),
      },
      {
        code: "07-09-19",
        label: "07-09-19",
        configurationTitle: "4-Seat Bumper Sectional",
        description: "",
        priceDiff: 0,
        image: img("Alula-SC-07-09-19.png"),
      },
      {
        code: "07-09-08",
        label: "07-09-08",
        configurationTitle: "4-Seat Corner Curve Sectional",
        description: "",
        priceDiff: 0,
        image: img("Alula-SC-07-09-08.png"),
      },
      {
        code: "12-40",
        label: "12-40",
        configurationTitle: "5-Seat L-Sectional",
        description: "",
        priceDiff: 0,
        image: img("Alula-SC-12-40.png"),
      },
    ],
    Acacia: [
      {
        code: "67-10-09-60-66",
        label: "67-10-09-60-66",
        configurationTitle:
          "4-Seat Corner Curve Sectional — Three Power Recliners",
        description: "",
        priceDiff: 0,
        image: img("Acacia-SC-67-10-09-60-66.png"),
      },
      {
        code: "67-w2-10-09-60-66",
        label: "67-W2-10-09-60-66",
        configurationTitle:
          "4-Seat Corner Curve Sectional — Console + Three Power Recliners (Wide)",
        description: "",
        priceDiff: 0,
        image: img("Acacia-SC-67-w2-10-09-60-66.png"),
      },
      {
        code: "67-w2-10-09-10-66",
        label: "67-W2-10-09-10-66",
        configurationTitle:
          "4-Seat Corner Curve Sectional — Console + Two Power Recliners (Wide)",
        description: "",
        priceDiff: 0,
        image: img("Acacia-SC-67-w2-10-09-10-66.png"),
      },
      {
        code: "67-10-09-10-66",
        label: "67-10-09-10-66",
        configurationTitle: "4-Seat L-Sectional",
        description: "",
        priceDiff: 0,
        image: img("Acacia-SC-67-10-09-10-66.png"),
      },
    ],
    Atticus: [
      {
        code: "07-15",
        label: "07-15",
        configurationTitle: "3-Seat Chaise Sectional",
        description: "",
        priceDiff: 0,
        image: img("Atticus-SC-07-15.png"),
      },
      {
        code: "07-40",
        label: "07-40",
        configurationTitle: "4-Seat L-Sectional",
        description: "",
        priceDiff: 0,
        image: img("Atticus-SC-07-40.png"),
      },
      {
        code: "07-11-08",
        label: "07-11-08",
        configurationTitle: "4-Seat L-Sectional (alternate)",
        description: "",
        priceDiff: 0,
        image: img("Atticus-SC-07-11-08.png"),
      },
    ],
    Colebrook: [
      {
        code: "07-15",
        label: "07-15",
        configurationTitle: "3-Seat Chaise Sectional",
        description: "",
        priceDiff: 0,
        image: img("Colebrook-SC-07-15.png"),
      },
      {
        code: "07-40",
        label: "07-40",
        configurationTitle: "4-Seat L-Sectional",
        description: "",
        priceDiff: 0,
        image: img("Colebrook-SC-07-40.png"),
      },
      {
        code: "07-35",
        label: "07-35",
        configurationTitle: "4-Seat Wedge Sectional",
        description: "",
        priceDiff: 0,
        image: img("Colebrook-SC-07-35.png"),
      },
      {
        code: "12-40",
        label: "12-40",
        configurationTitle: "5-Seat L-Sectional",
        description: "",
        priceDiff: 0,
        image: img("Colebrook-SC-12-40.png"),
      },
    ],
    Creighton: [
      {
        code: "07-40",
        label: "07-40",
        configurationTitle: "4-Seat L-Sectional",
        description: "",
        priceDiff: 0,
        image: img("Creighton-SC-07-40.png"),
      },
      {
        code: "07-09-08",
        label: "07-09-08",
        configurationTitle: "4-Seat Corner Curve Sectional",
        description: "",
        priceDiff: 0,
        image: img("Creighton-SC-07-09-08.png"),
      },
      {
        code: "12-35",
        label: "12-35",
        configurationTitle: "5-Seat L-Sectional (alternate)",
        description: "",
        priceDiff: 0,
        image: img("Creighton-SC-12-35.png"),
      },
      {
        code: "12-40",
        label: "12-40",
        configurationTitle: "5-Seat L-Sectional",
        description: "",
        priceDiff: 0,
        image: img("Creighton-SC-12-40.png"),
      },
    ],
  };

  window.SECTIONAL_CONFIGS = window.MTL_SECTIONAL_CONFIGS;

  console.log(
    "sectional-configs",
    "20260515-github-img-urls",
    window.MTL_SECTIONAL_CONFIGS
  );
})();
