#!/usr/bin/env node
/**
 * Audit Saranoni variant images on Volusion CDN vs expected naming.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const DETAIL = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Volusion_Saranoni_Products_OptionIDs_Import_Detail.csv"
);
const MANIFEST = path.join(__dirname, "..", "tmp", "sar-color-images-manifest.json");
const OUT = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Saranoni_Variant_Images_Upload_List.csv"
);
const CDN =
  "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/";

function parseCsv(text) {
  const rows = [];
  let i = 0,
    field = "",
    row = [],
    inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = (rows[0] || []).map((h) => h.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""]))
  );
}

function head(url) {
  return new Promise((resolve) => {
    https
      .request(url, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        resolve(res.statusCode || 0);
      })
      .on("error", () => resolve(0))
      .end();
  });
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const detail = parseCsv(fs.readFileSync(DETAIL, "utf8"));
  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  }
  const manifestByKey = new Map();
  for (const m of manifest) {
    manifestByKey.set(`${m.code}\0${m.optionId}`, m);
  }

  const headers = [
    "ProductCode",
    "ColorName",
    "OptionID",
    "T_File",
    "S_File",
    "T_Status",
    "S_Status",
    "ShopifySourceURL",
    "Action",
  ];
  const outRows = [];
  let missingT = 0,
    missingS = 0,
    ok = 0;

  for (let i = 0; i < detail.length; i++) {
    const r = detail[i];
    const pc = String(r.ProductCode || "").trim();
    const oid = String(r.OptionID || "").trim();
    const color = String(r.ColorName || "").trim();
    const tFile = `${pc}-${oid}-T.jpg`;
    const sFile = `${pc}-${oid}-S.jpg`;
    const tStatus = (await head(CDN + encodeURIComponent(tFile))) === 200 ? "OK" : "MISSING";
    const sStatus = (await head(CDN + encodeURIComponent(sFile))) === 200 ? "OK" : "MISSING";
    if (tStatus === "MISSING") missingT++;
    if (sStatus === "MISSING") missingS++;
    if (tStatus === "OK" && sStatus === "OK") ok++;
    const man = manifestByKey.get(`${pc}\0${oid}`);
    const action =
      tStatus === "MISSING" || sStatus === "MISSING"
        ? man
          ? "Upload from Saranoni (manifest has source)"
          : "Upload product-specific photo"
        : "Verify photo shows THIS product (not another SAR SKU)";
    outRows.push({
      ProductCode: pc,
      ColorName: color,
      OptionID: oid,
      T_File: tFile,
      S_File: sFile,
      T_Status: tStatus,
      S_Status: sStatus,
      ShopifySourceURL: man?.imageUrl || "",
      Action: action,
    });
    if ((i + 1) % 20 === 0) process.stdout.write(`  checked ${i + 1}/${detail.length}\r`);
    await new Promise((r) => setTimeout(r, 40));
  }

  const lines = [headers.join(",")];
  for (const row of outRows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(OUT, lines.join("\r\n") + "\r\n", "utf8");

  const byProduct = new Map();
  for (const row of outRows) {
    if (!byProduct.has(row.ProductCode)) byProduct.set(row.ProductCode, { ok: 0, miss: 0 });
    const b = byProduct.get(row.ProductCode);
    if (row.T_Status === "OK" && row.S_Status === "OK") b.ok++;
    else b.miss++;
  }
  const incomplete = [...byProduct.entries()]
    .filter(([, v]) => v.miss > 0)
    .sort((a, b) => b[1].miss - a[1].miss);

  console.log(`\nWrote ${OUT}`);
  console.log(`Total color slots: ${outRows.length}`);
  console.log(`Both T+S OK: ${ok}`);
  console.log(`Missing T: ${missingT}, Missing S: ${missingS}`);
  console.log(`Products with gaps: ${incomplete.length}/${byProduct.size}`);
  console.log("Worst gaps:");
  incomplete.slice(0, 8).forEach(([pc, v]) =>
    console.log(`  ${pc}: ${v.miss} colors missing images`)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
