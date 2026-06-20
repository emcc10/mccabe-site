#!/usr/bin/env node
/** Download correct Saranoni socks variant images for Volusion upload. */
const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Saranoni_Socks_Variant_Images_Fix"
);
const MAP = [
  { color: "Charcoal", optionId: "1048", imageId: 38352756867271 },
  { color: "Moonbeam", optionId: "1012", imageId: 38352756998343 },
];
const PC = "SAR-BMB-SOCKS";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { product } = await fetchJson("https://saranoni.com/products/bamboni-socks.json");
  const byId = new Map(product.images.map((i) => [i.id, i.src]));

  for (const row of MAP) {
    const src = byId.get(row.imageId);
    if (!src) {
      console.warn("no image for", row.color);
      continue;
    }
    const url = src.split("?")[0] + "?width=1200";
    const buf = await fetchBuf(url);
    const tPath = path.join(OUT, `${PC}-${row.optionId}-T.jpg`);
    fs.writeFileSync(tPath, buf);
    console.log("Wrote", tPath, buf.length);

    // simple swatch: reuse T for S (Volusion accepts; user can crop later)
    const sPath = path.join(OUT, `${PC}-${row.optionId}-S.jpg`);
    fs.writeFileSync(sPath, buf);
    console.log("Wrote", sPath);
  }
  console.log(`\nUpload both files to Volusion /v/vspfiles/photos/`);
  console.log(`Replace existing SAR-BMB-SOCKS-1048-T.jpg (currently a Lush blanket copy).`);
}

main().catch(console.error);
