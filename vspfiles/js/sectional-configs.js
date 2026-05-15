/**
 * Sectional configuration diagram cards — data only.
 * Keys must match Volusion style names (see getStyleFromPage / product codes before "-SC-").
 *
 * Regenerate every diagram PNG (no manual PDF pages): from repo,
 *   tools/sectional-diagrams/export_diagrams.ps1   OR   python export_sectional_diagrams.py --publish
 * Codes are read from this file; Palliser download URLs live only in tools/sectional-diagrams/catalog.json.
 * Then deploy vspfiles/sectional-diagrams/*.png to Volusion.
 */
window.MTL_SECTIONAL_CONFIGS = {
  Alula: [
    {
      code: "07-15",
      label: "07-15",
      configurationTitle: "3-Seat Chaise Sectional",
      description: "",
      priceDiff: 0,
      image: "/v/vspfiles/sectional-diagrams/Alula-SC-07-15.png",
    },
  ],
  Acacia: [
    {
      code: "67-10-09-10-66",
      label: "67-10-09-10-66",
      description: "Configuration 67-10-09-10-66",
      priceDiff: 0,
      image: "/v/vspfiles/sectional-diagrams/Acacia-SC-67-10-09-10-66.png",
    },
  ],
  Atticus: [
    {
      code: "07-15",
      label: "07-15",
      description: "Configuration 07-15",
      priceDiff: 0,
      image: "/v/vspfiles/sectional-diagrams/Atticus-SC-07-15.png",
    },
  ],
};

window.SECTIONAL_CONFIGS = window.MTL_SECTIONAL_CONFIGS;

console.log("sectional-configs", "20260515pdf-diagram-png", window.MTL_SECTIONAL_CONFIGS);
