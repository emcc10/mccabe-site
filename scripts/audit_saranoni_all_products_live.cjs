#!/usr/bin/env node
/**
 * Full Saranoni variant image audit: live catalog scrape + CDN presence + per-product duplicate detection.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "saranoni-image-repair-report");
const MCCABE_SEARCH =
  "https://www.mccabestheaterandliving.com/searchresults.asp?Search=SAR-&show=250";
const MCCABE_PDP =
  "https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode=";
const CDN_BASE =
  "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/";
const CDN_OPTIONS =
  "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/options/";
const DETAIL_FALLBACK = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Volusion_Saranoni_Products_OptionIDs_Import_Detail.csv"
);

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
  });
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

function fetchHash(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const h = crypto.createHash("md5");
        res.on("data", (c) => h.update(c));
        res.on("end", () => resolve(h.digest("hex")));
      })
      .on("error", () => resolve(null));
  });
}

function parseSearchProductCodes(html) {
  const codes = new Set();
  for (const m of html.matchAll(/title="([^"]*,\s*(SAR-[A-Z0-9-]+))"/gi)) {
    codes.add(m[2].trim().toUpperCase());
  }
  return [...codes].sort();
}

function parseLiveColorOptions(html, productCode) {
  const out = [];
  const re = new RegExp(
    `name=["']SELECT___${productCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}___(\\d+)["'][^>]*>([\\s\\S]*?)<\\/select>`,
    "i"
  );
  const m = html.match(re);
  if (!m) return out;
  const cat = m[1];
  if (cat !== "23" && cat !== "58") return out;
  for (const om of m[2].matchAll(/<option[^>]*value=["'](\d+)["'][^>]*>([^<]+)</gi)) {
    const id = om[1].trim();
    const label = om[2].replace(/&nbsp;/g, " ").trim();
    if (!id || !label || /^choose/i.test(label)) continue;
    out.push({ productCode, optionId: id, colorName: label, category: cat });
  }
  return out;
}

function parseDetailCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.replace(/^\uFEFF/, "").trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return {
      productCode: row.ProductCode,
      optionId: row.OptionID,
      colorName: row.ColorName,
      category: row.OptionCategoryID || "23",
    };
  });
}

async function probeFile(name) {
  const s = await head(CDN_BASE + encodeURIComponent(name));
  if (s === 200) return { status: "OK", url: CDN_BASE + name };
  const s2 = await head(CDN_OPTIONS + encodeURIComponent(name));
  if (s2 === 200) return { status: "OK", url: CDN_OPTIONS + name };
  return { status: "MISSING", url: "" };
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function scrapeCatalog(codes) {
  const slots = [];
  const concurrency = 8;
  const queue = [...codes];
  let done = 0;

  async function worker() {
    while (queue.length) {
      const pc = queue.shift();
      if (!pc) break;
      try {
        const html = await fetchText(MCCABE_PDP + encodeURIComponent(pc));
        const opts = parseLiveColorOptions(html, pc);
        if (!opts.length) {
          slots.push({
            productCode: pc,
            optionId: "",
            colorName: "",
            category: "",
            note: "NO_COLOR_OPTIONS_ON_PDP",
          });
        } else {
          for (const o of opts) slots.push({ ...o, note: "" });
        }
      } catch (err) {
        slots.push({
          productCode: pc,
          optionId: "",
          colorName: "",
          category: "",
          note: `SCRAPE_ERROR:${err.message}`,
        });
      }
      done++;
      if (done % 10 === 0 || done === codes.length) {
        process.stdout.write(`  scraped PDPs ${done}/${codes.length}\r`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, codes.length || 1) }, worker)
  );
  console.log(`\n  scraped ${done} PDPs, ${slots.filter((s) => s.optionId).length} variant slots`);
  return slots;
}

async function main() {
  const useDetailOnly = process.argv.includes("--detail-only");
  let slots = [];

  if (useDetailOnly) {
    slots = parseDetailCsv(DETAIL_FALLBACK).map((r) => ({
      productCode: r.productCode,
      optionId: r.optionId,
      colorName: r.colorName,
      category: r.category,
      note: "detail_csv",
    }));
    console.log(`Using Detail CSV: ${slots.length} slots`);
  } else {
    console.log("Fetching SAR product search...");
    const searchHtml = await fetchText(MCCABE_SEARCH);
    const codes = parseSearchProductCodes(searchHtml);
    console.log(`Found ${codes.length} SAR products on McCabe`);
    slots = await scrapeCatalog(codes);
  }

  const variantSlots = slots.filter((s) => s.optionId);
  const rows = [];
  const hashCache = new Map();
  const byProductHashes = new Map();

  for (let i = 0; i < variantSlots.length; i++) {
    const s = variantSlots[i];
    const pc = s.productCode;
    const oid = s.optionId;
    const tFile = `${pc}-${oid}-T.jpg`;
    const sFile = `${pc}-${oid}-S.jpg`;
    const tProbe = await probeFile(tFile);
    const sProbe = await probeFile(sFile);
    await new Promise((r) => setTimeout(r, 25));

    let tHash = "";
    let duplicateOf = "";
    let duplicateInProduct = "";
    if (tProbe.status === "OK") {
      const cacheKey = tProbe.url;
      if (!hashCache.has(cacheKey)) {
        hashCache.set(cacheKey, await fetchHash(tProbe.url));
        await new Promise((r) => setTimeout(r, 20));
      }
      tHash = hashCache.get(cacheKey) || "";
      if (tHash) {
        if (!byProductHashes.has(pc)) byProductHashes.set(pc, new Map());
        const pmap = byProductHashes.get(pc);
        if (pmap.has(tHash)) {
          duplicateInProduct = pmap.get(tHash);
        } else {
          pmap.set(tHash, tFile);
        }
      }
    }

    rows.push({
      ProductCode: pc,
      ColorName: s.colorName,
      OptionID: oid,
      Category: s.category,
      T_File: tFile,
      S_File: sFile,
      T_Status: tProbe.status,
      S_Status: sProbe.status,
      T_URL: tProbe.url,
      T_MD5: tHash,
      DuplicateInProduct: duplicateInProduct,
      Note: s.note,
    });
    if ((i + 1) % 25 === 0) process.stdout.write(`  audited ${i + 1}/${variantSlots.length}\r`);
  }

  const headers = [
    "ProductCode",
    "ColorName",
    "OptionID",
    "Category",
    "T_File",
    "S_File",
    "T_Status",
    "S_Status",
    "T_URL",
    "T_MD5",
    "DuplicateInProduct",
    "Note",
  ];
  const outCsv = path.join(REPORT_DIR, "04_full_variant_audit.csv");
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(outCsv, lines.join("\r\n") + "\r\n", "utf8");

  const missingT = rows.filter((r) => r.T_Status !== "OK");
  const missingS = rows.filter((r) => r.S_Status !== "OK");
  const dupes = rows.filter((r) => r.DuplicateInProduct);
  const products = new Set(rows.map((r) => r.ProductCode));
  const productsWithDupes = new Set(dupes.map((r) => r.ProductCode));
  const productsWithGaps = new Set(
    rows.filter((r) => r.T_Status !== "OK" || r.S_Status !== "OK").map((r) => r.ProductCode)
  );

  const summary = {
    audited_at: new Date().toISOString(),
    products_on_site: products.size,
    variant_slots: rows.length,
    both_ok: rows.filter((r) => r.T_Status === "OK" && r.S_Status === "OK").length,
    missing_t: missingT.length,
    missing_s: missingS.length,
    within_product_duplicate_t: dupes.length,
    products_with_gaps: productsWithGaps.size,
    products_with_duplicates: productsWithDupes.size,
    missing_t_files: missingT.map((r) => r.T_File),
    missing_s_files: missingS.map((r) => r.S_File),
    duplicate_examples: dupes.slice(0, 15).map((r) => ({
      file: r.T_File,
      duplicate_of: r.DuplicateInProduct,
      color: r.ColorName,
    })),
  };
  fs.writeFileSync(
    path.join(REPORT_DIR, "04_full_variant_audit_summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    "utf8"
  );

  console.log(`\nWrote ${outCsv}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
