#!/usr/bin/env node
/**
 * Volusion Products import: ProductCode, OptionIDs, EnableOptions_InventoryControl
 *
 * Color options are GLOBAL in Volusion (category 23): one Option ID per color name.
 * The same ID is reused across many Saranoni products (e.g. Moonbeam = 1012 on hats,
 * blankets, robes). Variant images are per product: {ProductCode}-{OptionID}-T.jpg.
 *
 * Sources for color name -> Option ID (export wins for id/desc/pricediff):
 *   1) Your Volusion Options standard export (SAVED_EXPORT_*.csv)
 *   2) Live McCabe PDP selects — discovers IDs already in Volusion, never creates new
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const MCCABE_BASE =
  "https://www.mccabestheaterandliving.com/ProductDetails.asp";
const MCCABE_SEARCH =
  "https://www.mccabestheaterandliving.com/searchresults.asp?Search=SAR-&show=250";
const COLOR_OPTION_CAT = "23";
const DEFAULT_OPTS = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "saranoni options.csv"
);
const DEFAULT_ASSIGN = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "saranoni_verified_color_assignments.csv"
);
const DEFAULT_OUT = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Volusion_Saranoni_Products_OptionIDs_Import.csv"
);

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQ = false;
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
  const dataRows = rows.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""]))
  );
  return { headers, rows: dataRows };
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function volusionCsvField(val) {
  return `"${String(val ?? "").replace(/"/g, '""')}"`;
}

function writeCsv(filePath, headers, dataRows) {
  const lines = [headers.join(",")];
  for (const row of dataRows) {
    lines.push(headers.map((h) => csvEscape(row[h] ?? "")).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\r\n") + "\r\n", "utf8");
}

function writeVolusionOptionsCsv(filePath, headers, dataRows) {
  const lines = [headers.join(",")];
  for (const row of dataRows) {
    lines.push(headers.map((h) => volusionCsvField(row[h] ?? "")).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\r\n") + "\r\n", "utf8");
}

function normColorKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function loadOptionsExport(optsPath) {
  const empty = {
    headers: [],
    rows: [],
    byDesc: new Map(),
    byId: new Map(),
    path: optsPath,
  };
  if (!fs.existsSync(optsPath)) {
    console.warn(`  options export not found: ${optsPath}`);
    return empty;
  }
  const { headers, rows } = parseCsv(fs.readFileSync(optsPath, "utf8"));
  const byDesc = new Map();
  const byId = new Map();
  for (const r of rows) {
    const id = String(r.id || r.ID || "").trim();
    const desc = String(r.optionsdesc || r.OptionsDesc || "").trim();
    const cat = String(r.optioncatid || r.OptionCatID || "").trim();
    if (!id || !desc) continue;
    if (cat && cat !== COLOR_OPTION_CAT) continue;
    const entry = {
      id,
      desc,
      cat: cat || COLOR_OPTION_CAT,
      pricediff: String(r.pricediff ?? r.PriceDiff ?? "0").trim() || "0",
      source: "export",
      exportRow: r,
      applytoproductcodes: String(r.applytoproductcodes || "").trim(),
    };
    byDesc.set(normColorKey(desc), entry);
    byId.set(id, entry);
  }
  return { headers, rows, byDesc, byId, path: optsPath };
}

function loadAssignments(assignPath) {
  const { rows } = parseCsv(fs.readFileSync(assignPath, "utf8").replace(/^\uFEFF/, ""));
  const products = new Map();
  let assignmentRows = 0;
  for (const r of rows) {
    const productCode = String(r.ProductCode || "").trim();
    const productName = String(r.ProductName || "").trim();
    const colorName = String(r.ColorName || "").trim();
    if (!productCode || !colorName) continue;
    assignmentRows++;
    if (!products.has(productCode)) {
      products.set(productCode, {
        productcode: productCode,
        productname: productName,
        colors: [],
      });
    }
    products.get(productCode).colors.push({
      name: colorName,
      pricediff: String(r.PriceDiff ?? "0").trim() || "0",
    });
  }
  return { products, assignmentRows };
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "Mozilla/5.0 (mccabe-site import builder)" } },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchText(
            res.headers.location.startsWith("http")
              ? res.headers.location
              : new URL(res.headers.location, url).href
          )
            .then(resolve)
            .catch(reject);
          return;
        }
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.setTimeout(45000, () => req.destroy(new Error("timeout")));
  });
}

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function parseLiveColorOptions(html, productCode) {
  const escaped = productCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<SELECT[^>]*name="SELECT___${escaped}___${COLOR_OPTION_CAT}"[^>]*>([\\s\\S]*?)<\\/SELECT>`,
    "i"
  );
  const m = html.match(re);
  if (!m) return [];
  const out = [];
  for (const om of m[1].matchAll(
    /<OPTION[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/OPTION>/gi
  )) {
    const id = String(om[1] || "").trim();
    let label = decodeHtml(om[2].replace(/<[^>]+>/g, " "));
    label = label.replace(/\s+/g, " ").trim();
    if (!id || !label) continue;
    if (/^(please|choose|select|--)/i.test(label)) continue;
    out.push({ id, desc: label, cat: COLOR_OPTION_CAT, source: "live" });
  }
  return out;
}

function parseSearchProductCodes(html) {
  const codes = new Set();
  for (const m of html.matchAll(
    /title="([^"]*,\s*(SAR-[A-Z0-9-]+))"/gi
  )) {
    codes.add(m[2].trim().toUpperCase());
  }
  return [...codes].sort();
}

async function scrapeLiveCatalog(productCodes) {
  const byDesc = new Map();
  const byId = new Map();
  const concurrency = 6;
  const queue = [...productCodes];
  let done = 0;

  async function worker() {
    while (queue.length) {
      const pc = queue.shift();
      if (!pc) break;
      try {
        const html = await fetchText(
          `${MCCABE_BASE}?ProductCode=${encodeURIComponent(pc)}`
        );
        for (const opt of parseLiveColorOptions(html, pc)) {
          const key = normColorKey(opt.desc);
          if (!byDesc.has(key)) {
            byDesc.set(key, {
              ...opt,
              pricediff: "0",
            });
          }
          if (!byId.has(opt.id)) byId.set(opt.id, byDesc.get(key));
        }
      } catch (err) {
        console.warn(`  live scrape failed ${pc}: ${err.message}`);
      }
      done++;
      if (done % 15 === 0 || done === productCodes.length) {
        process.stdout.write(`  scraped ${done}/${productCodes.length}\r`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, productCodes.length) }, worker)
  );
  console.log(
    `  live: ${byDesc.size} color names / ${byId.size} option IDs from ${productCodes.length} PDPs`
  );
  return { byDesc, byId };
}

function mergeCatalog(exportMap, liveMap) {
  const byDesc = new Map(exportMap.byDesc);
  const byId = new Map(exportMap.byId);
  const liveOnly = [];

  for (const [key, entry] of liveMap.byDesc) {
    if (byDesc.has(key)) continue;
    if (byId.has(entry.id)) continue;
    byDesc.set(key, { ...entry, pricediff: "0" });
    byId.set(entry.id, byDesc.get(key));
    liveOnly.push(entry.desc);
  }

  return { byDesc, byId, liveOnly };
}

function resolveColor(colorName, byDesc) {
  return byDesc.get(normColorKey(colorName)) || null;
}

function removeStale(pathToRemove) {
  if (fs.existsSync(pathToRemove)) fs.unlinkSync(pathToRemove);
}

async function main() {
  const exportOnly = process.argv.includes("--export-only");
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const optsPath = args[0] || DEFAULT_OPTS;
  const assignPath = args[1] || DEFAULT_ASSIGN;
  const outPath = args[2] || DEFAULT_OUT;

  const detailPath = outPath.replace(/\.csv$/i, "_Detail.csv");
  const issuesPath = outPath.replace(/\.csv$/i, "_Issues.csv");
  const catalogPath = outPath.replace(/\.csv$/i, "_ColorOptionCatalog.csv");
  const priceDiffPath = outPath.replace(/\.csv$/i, "_Options_PriceDiff_FromExport.csv");

  const exportMap = loadOptionsExport(optsPath);
  const skipLive =
    process.argv.includes("--no-live") ||
    exportOnly ||
    exportMap.byDesc.size >= 120;
  const { products, assignmentRows } = loadAssignments(assignPath);
  const assignProductCodes = [...products.keys()].sort();

  let liveMap = { byDesc: new Map(), byId: new Map() };
  if (!skipLive) {
    console.log("Discovering existing Volusion option IDs from McCabe PDPs...");
    let scrapeCodes = assignProductCodes;
    try {
      const searchHtml = await fetchText(MCCABE_SEARCH);
      const searchCodes = parseSearchProductCodes(searchHtml);
      scrapeCodes = [...new Set([...assignProductCodes, ...searchCodes])].sort();
      console.log(`  ${searchCodes.length} SAR products on site (${scrapeCodes.length} to scan)`);
    } catch (err) {
      console.warn(`  search scrape skipped: ${err.message}`);
    }
    liveMap = await scrapeLiveCatalog(scrapeCodes);
  }

  const { byDesc, byId, liveOnly } = mergeCatalog(exportMap, liveMap);

  const importRows = [];
  const detailRows = [];
  const issueRows = [];
  const usedOptionIds = new Set();
  const unmatchedNames = new Set();

  for (const [pc, data] of [...products.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const ids = [];
    const seen = new Set();
    const missing = [];

    for (const color of data.colors) {
      const hit = resolveColor(color.name, byDesc);
      if (!hit) {
        missing.push(color.name);
        unmatchedNames.add(color.name);
        continue;
      }
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      ids.push(hit.id);
      usedOptionIds.add(hit.id);
      detailRows.push({
        ProductCode: pc,
        ProductName: data.productname,
        ColorName: color.name,
        OptionID: hit.id,
        OptionCategoryID: hit.cat || COLOR_OPTION_CAT,
        OptionPriceDiff: hit.pricediff || "0",
        AssignmentPriceDiff: color.pricediff || "0",
        Source: hit.source || "",
      });
    }

    if (missing.length) {
      issueRows.push({
        ProductCode: pc,
        ProductName: data.productname,
        Issue: "name_not_in_options_catalog",
        UnmatchedColorNames: missing.join("; "),
        ResolvedOptionIDs: ids.length ? ids.join(",") : "",
        ExpectedColors: String(data.colors.length),
      });
    }
    if (!ids.length) continue;

    importRows.push({
      ProductCode: pc,
      OptionIDs: ids.join(","),
      EnableOptions_InventoryControl: "Y",
    });
  }

  writeCsv(
    outPath,
    ["ProductCode", "OptionIDs", "EnableOptions_InventoryControl"],
    importRows
  );

  writeCsv(
    detailPath,
    [
      "ProductCode",
      "ProductName",
      "ColorName",
      "OptionID",
      "OptionCategoryID",
      "OptionPriceDiff",
      "AssignmentPriceDiff",
      "Source",
    ],
    detailRows
  );

  writeCsv(
    catalogPath,
    [
      "ColorName",
      "OptionID",
      "OptionCategoryID",
      "PriceDiff",
      "ApplyToProductCodes",
      "Source",
    ],
    [...byDesc.values()]
      .sort((a, b) => a.desc.localeCompare(b.desc))
      .map((e) => ({
        ColorName: e.desc,
        OptionID: e.id,
        OptionCategoryID: e.cat || COLOR_OPTION_CAT,
        PriceDiff: e.pricediff || "0",
        ApplyToProductCodes: e.applytoproductcodes || "",
        Source: e.source || "",
      }))
  );

  const sarPriceDiffRows = exportMap.rows.filter((r) => {
    const cat = String(r.optioncatid || "").trim();
    const desc = String(r.optionsdesc || "").trim();
    const diff = String(r.pricediff ?? "0").trim();
    return cat === COLOR_OPTION_CAT && desc && diff !== "" && diff !== "0";
  });
  if (sarPriceDiffRows.length && exportMap.headers.length) {
    writeVolusionOptionsCsv(priceDiffPath, exportMap.headers, sarPriceDiffRows);
  } else {
    removeStale(priceDiffPath);
  }

  if (issueRows.length) {
    writeCsv(
      issuesPath,
      [
        "ProductCode",
        "ProductName",
        "Issue",
        "UnmatchedColorNames",
        "ResolvedOptionIDs",
        "ExpectedColors",
      ],
      issueRows
    );
  } else {
    removeStale(issuesPath);
  }

  for (const stale of [
    outPath.replace(/\.csv$/i, "_UnmappedColorNames.csv"),
    outPath.replace(/\.csv$/i, "_Missing_Options_To_Create.csv"),
    outPath.replace(/\.csv$/i, "_Partial_PendingOptions.csv"),
    outPath.replace(/\.csv$/i, "_AllResolved.csv"),
  ]) {
    removeStale(stale);
  }

  const completeProducts = importRows.filter((r) => {
    const issue = issueRows.find((i) => i.ProductCode === r.ProductCode);
    return !issue;
  }).length;

  console.log(`Options export: ${optsPath} (${exportMap.byDesc.size} Choose Color rows)`);
  if (!skipLive) {
    console.log(`Live discovery added: ${liveOnly.length} names (existing Volusion IDs only)`);
  }
  console.log(
    `Global catalog: ${byDesc.size} unique color names -> ${byId.size} option IDs`
  );
  console.log(
    `Assignments: ${assignmentRows} product-color rows across ${products.size} products`
  );
  console.log(
    `  (${unmatchedNames.size} distinct names unmatched; ${usedOptionIds.size} unique Option IDs used in import)`
  );
  console.log(`Products import: ${outPath} (${importRows.length} products, ${completeProducts} fully matched)`);
  console.log(`Catalog reference: ${catalogPath}`);
  if (sarPriceDiffRows.length) {
    console.log(`Options pricediff (from export): ${priceDiffPath} (${sarPriceDiffRows.length} rows)`);
  } else {
    console.log(
      "Saranoni color pricediff: all 0 in export (upcharges may be on child SKUs after inventory grid, or not set yet)"
    );
  }
  if (unmatchedNames.size) {
    console.log(
      `Issues: ${issuesPath} — unmatched names must match optionsdesc in your Options export exactly`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
