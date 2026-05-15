/**
 * Sectional configuration diagram cards — data only.
 * Keys must match Volusion style names (see getStyleFromPage / product codes before "-SC-").
 */
window.MTL_SECTIONAL_CONFIGS = {
  /* Alula 07-15 diagram: not in git; upload via Volusion to vspfiles/sectional-diagrams/Alula-SC-07-15.png (live URL /v/vspfiles/sectional-diagrams/Alula-SC-07-15.png). */
  Alula: [
    {
      code: "07-15",
      label: "07-15",
      configurationTitle: "3-Seat Chaise Sectional",
      description: "",
      dimensionsIn: '84 x 62"',
      dimensionsCm: "214 x 158 cm",
      priceDiff: 0,
      image: "/v/vspfiles/sectional-diagrams/Alula-SC-07-15.png",
    },
  ],
  Acacia: [
    {
      code: "67-10-09-10-66",
      label: "67-10-09-10-66",
      description: "Configuration 67-10-09-10-66",
      /* Add configurationTitle, dimensionsIn, dimensionsCm when spec is confirmed — shown beside diagram. */
      priceDiff: 0,
      image: "/v/vspfiles/sectional-diagrams/Acacia-SC-67-10-09-10-66.png",
    },
  ],
  Atticus: [
    {
      code: "07-15",
      label: "07-15",
      description: "Configuration 07-15",
      /* Add configurationTitle, dimensionsIn, dimensionsCm when spec is confirmed — shown beside diagram. */
      priceDiff: 0,
      image: "/v/vspfiles/sectional-diagrams/Atticus-SC-07-15.png",
    },
  ],
};

window.SECTIONAL_CONFIGS = window.MTL_SECTIONAL_CONFIGS;

console.log("sectional-configs", "20260515diag-dims", window.MTL_SECTIONAL_CONFIGS);
