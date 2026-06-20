#!/usr/bin/env node
/**
 * Assign SAR product codes to each Choose Color option + pricediff from Saranoni.com.
 * Updates saranoni options.csv applytoproductcodes and pricediff (global per option ID).
 * Also writes per-product-color rows for audit.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const COLOR_CAT = "23";
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
const OUT_OPTS = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "saranoni options assigned.csv"
);
const OUT_PRODUCT_COLOR = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Saranoni_Product_Color_Options.csv"
);
const OUT_PRICEDIFF_IMPORT = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Saranoni_Options_PriceDiff_Import.csv"
);
const OUT_CONFLICTS = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "Saranoni_Option_PriceDiff_Conflicts.csv"
);

// Shopify handle fallbacks when assignment SourceURL uses retired slugs.
const HANDLE_ALIASES = {
  "grand-faux-fur-throw-blankets": "grand-faux-fur-throw-blankets-new",
  "grand-faux-fur-xl-throw-blankets": "grand-faux-fur-xl-throw-blankets-new",
};

const CODE_TO_HANDLE = {
  "SAR-GRAND-FX-FUR": "grand-faux-fur-throw-blankets-new",
  "SAR-GRAND-FX-FUR-XL-LG": "grand-faux-fur-xl-throw-blankets-new",
  "SAR-GRAND-FX-FUR-KING": "grand-faux-fur-king-blanket",
  "SAR-GRAND-FX-FUR-QUEEN": "grand-faux-fur-queen-blanket",
  "SAR-GRAND-FX-FUR-12X20": "grand-faux-fur-12x20-pillow-cover",
  "SAR-GRAND-FX-FUR-2-PACK-EURO": "grand-faux-fur-2-pack-euro-pillow-covers",
  "SAR-MNKY-LUSH-XL-LG": "minky-lush-xl-blankets",
  "SAR-MNKY-LUSH-TOD": "minky-lush-toddler-blankets",
  "SAR-DBL-RCH-FX-FUR": "ruched-minky-throw-blanket",
  "SAR-DBL-RCH-FX-FUR-XL-LG": "ruched-minky-extra-large-throw-blanket",
  "SAR-BMBU-RYN-MSLN-XL-LG-4": "bamboo-rayon-muslin-extra-large-4-layer-quilt",
  "SAR-BMBU-RYN-MSLN-QUEEN-KING": "bamboo-rayon-muslin-queen-king-4-layer-quilt",
  "SAR-BMBU-RYN-MSLN-PILLOWCA": "bamboo-rayon-muslin-pillowcase-set",
  "SAR-DBL-LAYER-BMB-TOD": "double-layer-bamboni-toddler-blanket",
  "SAR-WFL-KNT": "waffle-knit-throw-blankets-1",
  "SAR-WFL-KNT-XL-LG": "waffle-knit-throw-blankets",
  "SAR-WFL-KNT-KING": "waffle-knit-king-blankets",
  "SAR-WFL-KNT-QUEEN": "waffle-knit-queen-blankets",
  "SAR-WFL-KNT-TWIN": "waffle-knit-twin-blankets",
  "SAR-WFL-KNT-TOD": "waffle-knit-toddler-blankets",
  "SAR-WFL-KNT-ROBES": "waffle-knit-robes",
};

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
  return {
    headers,
    rows: rows.slice(1).map((r) =>
      Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""]))
    ),
  };
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, dataRows) {
  const lines = [headers.join(",")];
  for (const row of dataRows) {
    lines.push(headers.map((h) => csvEscape(row[h] ?? "")).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\r\n") + "\r\n", "utf8");
}

function normKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(
            res.headers.location.startsWith("http")
              ? res.headers.location
              : new URL(res.headers.location, url).href
          )
            .then(resolve)
            .catch(reject);
          return;
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject)
      .setTimeout(45000, function () {
        this.destroy(new Error("timeout"));
      });
  });
}

function handleFromUrl(url) {
  const m = String(url || "").match(/\/products\/([^/?#]+)/i);
  return m ? m[1] : "";
}

function resolveHandle(productcode, urlHandle) {
  const aliases = [];
  if (urlHandle) aliases.push(HANDLE_ALIASES[urlHandle] || urlHandle);
  const codeHandle = CODE_TO_HANDLE[productcode];
  if (codeHandle && !aliases.includes(codeHandle)) aliases.push(codeHandle);
  return aliases;
}

function colorPriceDiffs(product) {
  const variants = product.variants || [];
  const options = product.options || [];
  if (!variants.length) return {};

  const optNames = options.map((o) => (o.name || "").toLowerCase());
  let colorIdx = optNames.indexOf("color");
  if (colorIdx < 0 && options.length === 1) {
    const vals = (options[0].values || []).filter((v) => v && v !== "Default Title");
    if (vals.length > 1) colorIdx = 0;
  }
  if (colorIdx < 0) return {};

  const base = Math.min(...variants.map((v) => parseFloat(v.price)));
  const out = {};
  for (const v of variants) {
    const opts = [v.option1, v.option2, v.option3];
    const label = opts[colorIdx];
    if (!label || label === "Default Title") continue;
    const diff = Math.round(parseFloat(v.price) - base);
    if (!(label in out) || diff < out[label]) out[label] = diff;
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const optsPath = process.argv[2] || DEFAULT_OPTS;
  const assignPath = process.argv[3] || DEFAULT_ASSIGN;

  const { headers, rows: optRows } = parseCsv(fs.readFileSync(optsPath, "utf8"));
  const { rows: assignRows } = parseCsv(
    fs.readFileSync(assignPath, "utf8").replace(/^\uFEFF/, "")
  );

  const colorByName = new Map();
  const optionById = new Map();
  for (const r of optRows) {
    if (String(r.optioncatid || "").trim() !== COLOR_CAT) continue;
    const id = String(r.id || "").trim();
    const desc = String(r.optionsdesc || "").trim();
    if (!id || !desc) continue;
    colorByName.set(normKey(desc), { id, desc, row: r });
    optionById.set(id, { id, desc, row: r });
  }

  const productColors = [];
  const productsByHandle = new Map();

  for (const r of assignRows) {
    const pc = String(r.ProductCode || "").trim();
    const color = String(r.ColorName || "").trim();
    const url = String(r.SourceURL || "").trim();
    if (!pc || !color) continue;
    const hit = colorByName.get(normKey(color));
    if (!hit) {
      console.warn(`  no option id for color "${color}" (${pc})`);
      continue;
    }
    productColors.push({
      productcode: pc,
      productname: String(r.ProductName || "").trim(),
      colorname: color,
      optionid: hit.id,
      handle: handleFromUrl(url),
      sourceurl: url,
    });
    if (!productsByHandle.has(pc)) {
      productsByHandle.set(pc, { productcode: pc, handle: handleFromUrl(url), url });
    }
  }

  const priceByProductColor = new Map();
  const handlesDone = new Map();
  let fetched = 0;
  for (const { productcode, handle: urlHandle } of productsByHandle.values()) {
    const candidates = resolveHandle(productcode, urlHandle);
    if (!candidates.length) continue;

    let diffs = null;
    for (const handle of candidates) {
      if (handlesDone.has(handle)) {
        diffs = handlesDone.get(handle);
        break;
      }
      try {
        const data = await fetchJson(
          `https://saranoni.com/products/${encodeURIComponent(handle)}.json`
        );
        diffs = colorPriceDiffs(data.product || {});
        handlesDone.set(handle, diffs);
        fetched++;
        if (fetched % 5 === 0) process.stdout.write(`  shopify ${fetched}\r`);
        await sleep(300);
        break;
      } catch (err) {
        if (handle === candidates[candidates.length - 1]) {
          console.warn(
            `  shopify failed ${productcode} (${candidates.join(" -> ")}): ${err.message}`
          );
        }
      }
    }
    if (!diffs) {
      for (const h of candidates) handlesDone.set(h, {});
      continue;
    }
    for (const [color, diff] of Object.entries(diffs)) {
      priceByProductColor.set(`${productcode}\0${normKey(color)}`, diff);
    }
  }
  console.log(`  shopify: ${fetched} products fetched for price diffs`);

  const applyByOptionId = new Map();
  const diffsByOptionId = new Map();
  const conflicts = [];

  const productColorOut = [];
  for (const pc of productColors) {
    const diff =
      priceByProductColor.get(`${pc.productcode}\0${normKey(pc.colorname)}`) ?? 0;

    if (!applyByOptionId.has(pc.optionid)) applyByOptionId.set(pc.optionid, new Set());
    applyByOptionId.get(pc.optionid).add(pc.productcode);

    productColorOut.push({
      productcode: pc.productcode,
      productname: pc.productname,
      optionid: pc.optionid,
      optionsdesc: pc.colorname,
      pricediff: String(diff),
    });

    if (!diffsByOptionId.has(pc.optionid)) diffsByOptionId.set(pc.optionid, new Map());
    const perProduct = diffsByOptionId.get(pc.optionid);
    perProduct.set(pc.productcode, diff);
  }

  const diffByOptionId = new Map();
  for (const [optionid, perProduct] of diffsByOptionId.entries()) {
    const values = [...new Set(perProduct.values())];
    if (values.length === 1) {
      diffByOptionId.set(optionid, values[0]);
      continue;
    }
    const nonZero = values.filter((v) => v > 0);
    if (nonZero.length === 0) {
      diffByOptionId.set(optionid, 0);
      continue;
    }
    diffByOptionId.set(optionid, 0);
    const hit = optionById.get(optionid);
    for (const [productcode, diff] of perProduct.entries()) {
      if (diff === 0) continue;
      conflicts.push({
        optionid,
        optionsdesc: hit?.desc || "",
        productcode,
        pricediff: String(diff),
        otherpricediff: values.filter((v) => v !== diff).join("|") || "0",
        note:
          "Volusion option pricediff is global — left 0 on option row; set child SKU price from Saranoni_Product_Color_Options.csv",
      });
    }
  }

  const updatedRows = optRows.map((r) => {
    const id = String(r.id || "").trim();
    const cat = String(r.optioncatid || "").trim();
    if (cat !== COLOR_CAT || !id) return { ...r };

    const apply = applyByOptionId.get(id);
    const newApply = apply ? [...apply].sort().join(",") : String(r.applytoproductcodes || "");
    const newDiff =
      diffByOptionId.has(id) ? String(diffByOptionId.get(id)) : String(r.pricediff ?? "0");

    return {
      ...r,
      applytoproductcodes: newApply,
      pricediff: newDiff,
    };
  });

  writeCsv(OUT_OPTS, headers, updatedRows);
  writeCsv(
    OUT_PRODUCT_COLOR,
    ["productcode", "productname", "optionid", "optionsdesc", "pricediff"],
    productColorOut.sort((a, b) =>
      a.productcode.localeCompare(b.productcode) ||
      a.optionsdesc.localeCompare(b.optionsdesc)
    )
  );

  const pricediffImport = updatedRows.filter((r) => {
    const cat = String(r.optioncatid || "").trim();
    const desc = String(r.optionsdesc || "").trim();
    const diff = String(r.pricediff ?? "0").trim();
    return cat === COLOR_CAT && desc && diff !== "" && diff !== "0";
  });
  if (pricediffImport.length) {
    writeCsv(OUT_PRICEDIFF_IMPORT, headers, pricediffImport);
  }

  if (conflicts.length) {
    writeCsv(
      OUT_CONFLICTS,
      ["optionid", "optionsdesc", "productcode", "pricediff", "otherpricediff", "note"],
      conflicts
    );
  }

  const withApply = [...applyByOptionId.values()].reduce((n, s) => n + s.size, 0);
  const withDiff = [...diffByOptionId.values()].filter((d) => d > 0).length;
  console.log(`Updated options: ${OUT_OPTS}`);
  console.log(`Product-color rows: ${OUT_PRODUCT_COLOR} (${productColorOut.length} rows)`);
  console.log(`Options with SAR applytoproductcodes: ${applyByOptionId.size} color IDs`);
  console.log(`Options with pricediff > 0: ${withDiff}`);
  if (pricediffImport.length) {
    console.log(`PriceDiff import: ${OUT_PRICEDIFF_IMPORT} (${pricediffImport.length} rows)`);
  }
  if (conflicts.length) {
    console.log(`Conflicts (review): ${OUT_CONFLICTS} (${conflicts.length} rows)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
