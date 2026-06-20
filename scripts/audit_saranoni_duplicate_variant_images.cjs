#!/usr/bin/env node
/** Find SAR variant T images that are byte-identical to a wrong donor (e.g. Lush Charcoal). */
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const DETAIL = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Volusion_Saranoni_Products_OptionIDs_Import_Detail.csv"
);
const OUT = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Saranoni_Duplicate_Variant_Images.csv"
);
const CDN =
  "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/";

function parseCsv(text) {
  const rows = [];
  let i = 0,
    f = "",
    row = [],
    q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        f += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        q = false;
        i++;
        continue;
      }
      f += c;
      i++;
      continue;
    }
    if (c === '"') {
      q = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(f);
      f = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      f = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      i++;
      continue;
    }
    f += c;
    i++;
  }
  if (f || row.length) {
    row.push(f);
    rows.push(row);
  }
  const h = (rows[0] || []).map((x) => x.replace(/^\uFEFF/, ""));
  return rows.slice(1).map((r) => Object.fromEntries(h.map((x, j) => [x, r[j] ?? ""])));
}

function fetch(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({
            hash: crypto.createHash("md5").update(buf).digest("hex"),
            len: buf.length,
          });
        });
      })
      .on("error", () => resolve(null));
  });
}

async function main() {
  const rows = parseCsv(fs.readFileSync(DETAIL, "utf8"));
  const cache = new Map();
  const dupes = [];

  for (let i = 0; i < rows.length; i++) {
    const pc = rows[i].ProductCode;
    const oid = rows[i].OptionID;
    const color = rows[i].ColorName;
    const file = `${pc}-${oid}-T.jpg`;
    let meta = cache.get(file);
    if (!meta) {
      meta = await fetch(CDN + encodeURIComponent(file));
      cache.set(file, meta);
      await new Promise((r) => setTimeout(r, 30));
    }
    if (!meta) continue;
    const key = meta.hash;
    if (!cache.has("hash:" + key)) cache.set("hash:" + key, file);
    else {
      const donor = cache.get("hash:" + key);
      if (donor !== file) {
        dupes.push({
          ProductCode: pc,
          ColorName: color,
          OptionID: oid,
          T_File: file,
          DuplicateOf: donor,
          Bytes: meta.len,
        });
      }
    }
    if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}/${rows.length}\r`);
  }

  const lines = [
    "ProductCode,ColorName,OptionID,T_File,DuplicateOf,Bytes",
    ...dupes.map(
      (d) =>
        `${d.ProductCode},${d.ColorName},${d.OptionID},${d.T_File},${d.DuplicateOf},${d.Bytes}`
    ),
  ];
  fs.writeFileSync(OUT, lines.join("\r\n") + "\r\n");
  console.log(`\nWrote ${OUT} (${dupes.length} duplicate variant images)`);
  dupes.slice(0, 10).forEach((d) =>
    console.log(`  ${d.T_File} same as ${d.DuplicateOf}`)
  );
}

main().catch(console.error);
