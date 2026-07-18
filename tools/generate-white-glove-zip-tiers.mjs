import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "tmp", "2025_Gaz_zcta_national", "2025_Gaz_zcta_national.txt");
const outputPath = path.join(repoRoot, "vspfiles", "js", "mc-white-glove-zip-tiers-data.js");

const FORNEY = Object.freeze({ latitude: 32.742601, longitude: -96.452883 });
const SOUTH_SURCHARGE = 55;
const TIERS = Object.freeze([
  { id: "0-20", minMiles: 0, maxMiles: 20, basePrice: 150 },
  { id: "21-30", minMiles: 20, maxMiles: 30, basePrice: 225 },
  { id: "31-50", minMiles: 30, maxMiles: 50, basePrice: 295 },
  { id: "51-70", minMiles: 50, maxMiles: 70, basePrice: 365 },
]);

function radians(value) {
  return (value * Math.PI) / 180;
}

function distanceMiles(latitude, longitude) {
  const earthRadiusMiles = 3958.7613;
  const latitudeDelta = radians(latitude - FORNEY.latitude);
  const longitudeDelta = radians(longitude - FORNEY.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(FORNEY.latitude)) *
      Math.cos(radians(latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tierFor(distance) {
  return TIERS.find((tier) => distance <= tier.maxMiles) || null;
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing Census Gazetteer source: ${sourcePath}`);
}

const lines = fs.readFileSync(sourcePath, "utf8").trim().split(/\r?\n/);
const headers = lines.shift().split("|");
const index = Object.fromEntries(headers.map((header, position) => [header, position]));
const zips = {};

for (const line of lines) {
  const columns = line.split("|");
  const zip = columns[index.GEOID];
  const latitude = Number(columns[index.INTPTLAT]);
  const longitude = Number(columns[index.INTPTLONG]);
  if (!/^7[45-6]\d{3}$/.test(zip) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

  const distance = distanceMiles(latitude, longitude);
  const tier = tierFor(distance);
  if (!tier) continue;

  const direction = latitude < FORNEY.latitude ? "south" : "north";
  const directionSurcharge = direction === "south" ? SOUTH_SURCHARGE : 0;
  zips[zip] = {
    distanceMiles: Number(distance.toFixed(1)),
    direction,
    tier: tier.id,
    basePrice: tier.basePrice,
    directionSurcharge,
    priceBeforeWeight: tier.basePrice + directionSurcharge,
  };
}

const payload = {
  version: "20260716wg1",
  source: "U.S. Census Bureau 2025 Gazetteer ZCTA representative coordinates",
  distanceMethod: "Haversine straight-line distance between representative coordinates",
  forney: FORNEY,
  southSurcharge: SOUTH_SURCHARGE,
  tiers: TIERS,
  zips,
};

const output = `(function (g) {\n  "use strict";\n  g.__MC_WHITE_GLOVE_ZIP_TIERS__ = ${JSON.stringify(payload, null, 2)};\n})(typeof window !== "undefined" ? window : globalThis);\n`;
fs.writeFileSync(outputPath, output, "utf8");
console.log(`Generated ${Object.keys(zips).length} white-glove ZIP entries at ${outputPath}`);
