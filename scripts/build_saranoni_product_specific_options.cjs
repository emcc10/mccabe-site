#!/usr/bin/env node
/**
 * Build product-specific Saranoni color options:
 *   "Minky Lush Throw: White" instead of shared global "White"
 *
 * Outputs:
 *   Saranoni_Product_Specific_Options_Master.csv
 *   Saranoni_Product_Specific_Options_Import.csv  (Volusion Options — import FIRST)
 *   Saranoni_Product_Specific_Products_Import.csv (only if --with-export after re-export)
 *   Saranoni_Variant_Image_Rename_After_Options.csv
 */
const fs = require("fs");
const path = require("path");

const COLOR_CAT = "23";
const DL = path.join(process.env.USERPROFILE || "", "Downloads");
const DEFAULT_ASSIGN = path.join(DL, "saranoni_verified_color_assignments.csv");
const DEFAULT_PRICED = path.join(DL, "Saranoni_Product_Color_Options.csv");
const DEFAULT_TEMPLATE = path.join(DL, "SAVED_EXPORT_42T7ZU4BYY.csv");
const OUT_MASTER = path.join(DL, "Saranoni_Product_Specific_Options_Master.csv");
const OUT_OPTIONS = path.join(DL, "Saranoni_Product_Specific_Options_Import.csv");
const OUT_PRODUCTS = path.join(DL, "Saranoni_Product_Specific_Products_Import.csv");
const OUT_RENAME = path.join(DL, "Saranoni_Variant_Image_Rename_After_Options.csv");

const SHORT_NAME_OVERRIDES = {
  "SAR-MNKY-LUSH": "Minky Lush Throw",
  "SAR-MNKY-LUSH-XL-LG": "Minky Lush XL Throw",
  "SAR-MNKY-LUSH-TOD": "Minky Lush Toddler",
  "SAR-BMB-SNUGGLER": "Bamboni Snuggler",
  "SAR-SNUGGLER": "Lush Snuggler",
  "SAR-LUSH": "Lush Throw",
  "SAR-LUSH-XL-LG": "Lush XL Throw",
  "SAR-LUSH-TOD": "Lush Toddler",
  "SAR-LUSH-MINI": "Lush Mini",
  "SAR-LUSH-RCV": "Lush Receiving",
  "SAR-GRAND-FX-FUR": "Grand Faux Fur Throw",
  "SAR-GRAND-FX-FUR-XL-LG": "Grand Faux Fur XL Throw",
  "SAR-GRAND-FX-FUR-KING": "Grand Faux Fur King",
  "SAR-GRAND-FX-FUR-QUEEN": "Grand Faux Fur Queen",
  "SAR-GRAND-FX-FUR-12X20": "Grand Faux Fur 12x20 Pillow",
  "SAR-GRAND-FX-FUR-22X22": "Grand Faux Fur 22x22 Pillow",
  "SAR-GRAND-FX-FUR-2-PACK-EURO": "Grand Faux Fur Euro Pillow 2-Pack",
  "SAR-DBL-RCH-FX-FUR": "Double Ruched Faux Fur Throw",
  "SAR-DBL-RCH-FX-FUR-XL-LG": "Double Ruched Faux Fur XL",
  "SAR-BMB-TOD": "Bamboni Toddler",
  "SAR-BMB-TWIN": "Bamboni Twin",
  "SAR-BMB-HATS": "Bamboni Hat",
  "SAR-BMB-SETS": "Bamboni Set",
  "SAR-BMB-SOCKS": "Bamboni Socks",
  "SAR-WFL-KNT": "Waffle Knit Throw",
  "SAR-WFL-KNT-XL-LG": "Waffle Knit XL Throw",
  "SAR-WFL-KNT-KING": "Waffle Knit King",
  "SAR-WFL-KNT-QUEEN": "Waffle Knit Queen",
  "SAR-WFL-KNT-TWIN": "Waffle Knit Twin",
  "SAR-WFL-KNT-TOD": "Waffle Knit Toddler",
  "SAR-WFL-KNT-ROBES": "Waffle Knit Robe",
  "SAR-PTRN-FX-FUR-XL-LG": "Patterned Faux Fur XL",
  "SAR-MARBLE-FX-FUR-MNKY-XL-LG": "Marble Faux Fur XL",
  "SAR-DBL-LAYER-BMB-TOD": "Double Layer Bamboni Toddler",
  "SAR-BMBU-RYN-MSLN-XL-LG-4": "Muslin XL 4-Layer Quilt",
  "SAR-BMBU-RYN-MSLN-QUEEN-KING": "Muslin Queen/King Quilt",
  "SAR-BMBU-RYN-MSLN-PILLOWCA": "Muslin Pillowcase Set",
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

function volusionField(val) {
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
    lines.push(headers.map((h) => volusionField(row[h] ?? "")).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\r\n") + "\r\n", "utf8");
}

function shortProductName(productCode, productName) {
  if (SHORT_NAME_OVERRIDES[productCode]) return SHORT_NAME_OVERRIDES[productCode];
  return String(productName || productCode)
    .replace(/\bThrow Blankets?\b/gi, "Throw")
    .replace(/\bBlankets?\b/gi, "")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function optionLabel(shortName, colorName) {
  return `${shortName}: ${colorName}`;
}

function loadTemplateRow(templatePath) {
  const { headers, rows } = parseCsv(fs.readFileSync(templatePath, "utf8"));
  let template =
    rows.find((r) => String(r.id || "").trim() === "1001") ||
    rows.find((r) => String(r.optionsdesc || "").trim() === "Clara") ||
    rows[0];
  if (!template) throw new Error(`No template row in ${templatePath}`);
  return { headers, template };
}

function buildMasterRows(assignPath, pricedPath) {
  const { rows: assignRows } = parseCsv(
    fs.readFileSync(assignPath, "utf8").replace(/^\uFEFF/, "")
  );
  const priceByKey = new Map();
  if (fs.existsSync(pricedPath)) {
    const { rows: pricedRows } = parseCsv(fs.readFileSync(pricedPath, "utf8"));
    for (const r of pricedRows) {
      const pc = String(r.productcode || r.ProductCode || "").trim();
      const color = String(r.optionsdesc || r.ColorName || "").trim();
      const diff = String(r.pricediff || r.PriceDiff || "0").trim() || "0";
      if (pc && color) priceByKey.set(`${pc}\0${color.toLowerCase()}`, diff);
    }
  }

  const master = [];
  for (const r of assignRows) {
    const productCode = String(r.ProductCode || "").trim();
    const productName = String(r.ProductName || "").trim();
    const colorName = String(r.ColorName || "").trim();
    const legacyOptionId = String(r.LegacyOptionID || "").trim();
    if (!productCode || !colorName) continue;
    const shortName = shortProductName(productCode, productName);
    const label = optionLabel(shortName, colorName);
    const pricediff =
      priceByKey.get(`${productCode}\0${colorName.toLowerCase()}`) ??
      (String(r.PriceDiff || "0").trim() || "0");
    master.push({
      ProductCode: productCode,
      ProductName: productName,
      ProductShortName: shortName,
      ColorName: colorName,
      OptionLabel: label,
      LegacyOptionID: legacyOptionId,
      PriceDiff: pricediff,
      LegacyT_File: `${productCode}-${legacyOptionId || "NEW"}-T.jpg`,
      LegacyS_File: `${productCode}-${legacyOptionId || "NEW"}-S.jpg`,
    });
  }
  return master;
}

function enrichLegacyIds(master, detailPath, legacyOptsPath) {
  const byPcColor = new Map();
  if (fs.existsSync(detailPath)) {
    const { rows } = parseCsv(fs.readFileSync(detailPath, "utf8"));
    for (const r of rows) {
      byPcColor.set(
        `${r.ProductCode}\0${String(r.ColorName || "").toLowerCase()}`,
        String(r.OptionID || "").trim()
      );
    }
  }
  for (const row of master) {
    if (row.LegacyOptionID) continue;
    const hit = byPcColor.get(`${row.ProductCode}\0${row.ColorName.toLowerCase()}`);
    if (hit) {
      row.LegacyOptionID = hit;
      row.LegacyT_File = `${row.ProductCode}-${hit}-T.jpg`;
      row.LegacyS_File = `${row.ProductCode}-${hit}-S.jpg`;
    }
  }
  return master;
}

function buildOptionsImport(master, templatePath) {
  const { headers, template } = loadTemplateRow(templatePath);
  const optionRows = master.map((m) => {
    const row = { ...template };
    row.id = "";
    row.optioncategoriesdesc = row.optioncategoriesdesc || "Choose Color";
    row.optioncatid = COLOR_CAT;
    row.optionsdesc = m.OptionLabel;
    row.pricediff = m.PriceDiff;
    row.lastmodified = "";
    row.lastmodby = row.lastmodby || "1";
    return row;
  });
  return { headers, optionRows };
}

function buildProductsImport(master, exportPath) {
  const { rows } = parseCsv(fs.readFileSync(exportPath, "utf8"));
  const idByLabel = new Map();
  for (const r of rows) {
    const cat = String(r.optioncatid || r.OptionCatID || "").trim();
    const desc = String(r.optionsdesc || r.OptionsDesc || "").trim();
    const id = String(r.id || r.ID || "").trim();
    if (cat === COLOR_CAT && desc && id) idByLabel.set(desc, id);
  }

  const byProduct = new Map();
  const renameRows = [];
  const missing = [];

  for (const m of master) {
    const newId = idByLabel.get(m.OptionLabel);
    if (!newId) {
      missing.push(m);
      continue;
    }
    m.NewOptionID = newId;
    m.NewT_File = `${m.ProductCode}-${newId}-T.jpg`;
    m.NewS_File = `${m.ProductCode}-${newId}-S.jpg`;
    if (!byProduct.has(m.ProductCode)) byProduct.set(m.ProductCode, []);
    byProduct.get(m.ProductCode).push(newId);
    if (m.LegacyOptionID && m.LegacyOptionID !== newId) {
      renameRows.push({
        ProductCode: m.ProductCode,
        ColorName: m.ColorName,
        OptionLabel: m.OptionLabel,
        LegacyOptionID: m.LegacyOptionID,
        NewOptionID: newId,
        OldT_File: m.LegacyT_File,
        NewT_File: m.NewT_File,
        OldS_File: m.LegacyS_File,
        NewS_File: m.NewS_File,
      });
    }
  }

  const productRows = [...byProduct.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ProductCode, ids]) => ({
      ProductCode,
      OptionIDs: ids.join(","),
      EnableOptions_InventoryControl: "Y",
    }));

  return { productRows, renameRows, missing };
}

function main() {
  const args = process.argv.slice(2);
  const exportPath = args.find((a) => !a.startsWith("-"));
  const assignPath = DEFAULT_ASSIGN;
  const pricedPath = DEFAULT_PRICED;
  const detailPath = path.join(DL, "Volusion_Saranoni_Products_OptionIDs_Import_Detail.csv");
  const templatePath = fs.existsSync(DEFAULT_TEMPLATE)
    ? DEFAULT_TEMPLATE
    : path.join(DL, "saranoni options.csv");

  let master = buildMasterRows(assignPath, pricedPath);
  master = enrichLegacyIds(master, detailPath);

  writeCsv(
    OUT_MASTER,
    [
      "ProductCode",
      "ProductName",
      "ProductShortName",
      "ColorName",
      "OptionLabel",
      "LegacyOptionID",
      "PriceDiff",
      "LegacyT_File",
      "LegacyS_File",
      "NewOptionID",
      "NewT_File",
      "NewS_File",
    ],
    master.map((m) => ({
      ...m,
      NewOptionID: m.NewOptionID || "",
      NewT_File: m.NewT_File || "",
      NewS_File: m.NewS_File || "",
    }))
  );

  const { headers, optionRows } = buildOptionsImport(master, templatePath);
  writeVolusionOptionsCsv(OUT_OPTIONS, headers, optionRows);

  const withDiff = master.filter((m) => String(m.PriceDiff) !== "0").length;
  console.log(`Master: ${OUT_MASTER} (${master.length} rows)`);
  console.log(`Options import: ${OUT_OPTIONS} (${optionRows.length} new product-specific colors)`);
  console.log(`  with pricediff > 0: ${withDiff}`);
  console.log(`  format: "Product Short Name: Color"`);

  if (exportPath && fs.existsSync(exportPath)) {
    const { productRows, renameRows, missing } = buildProductsImport(master, exportPath);
    writeCsv(OUT_PRODUCTS, ["ProductCode", "OptionIDs", "EnableOptions_InventoryControl"], productRows);
    writeCsv(
      OUT_RENAME,
      [
        "ProductCode",
        "ColorName",
        "OptionLabel",
        "LegacyOptionID",
        "NewOptionID",
        "OldT_File",
        "NewT_File",
        "OldS_File",
        "NewS_File",
      ],
      renameRows
    );
    console.log(`Products import: ${OUT_PRODUCTS} (${productRows.length} products)`);
    console.log(`Image renames: ${OUT_RENAME} (${renameRows.length} files to rename)`);
    if (missing.length) {
      console.warn(`  ${missing.length} option labels not found in export — re-export Options after import`);
    }
  } else {
    console.log("\nNext steps:");
    console.log("  1) Import Saranoni_Product_Specific_Options_Import.csv → Volusion OPTIONS table");
    console.log("  2) Export Options to a new CSV");
    console.log("  3) Run: node scripts/build_saranoni_product_specific_options.cjs \"Downloads/your-export.csv\"");
    console.log("     → generates Products import + image rename list");
  }
}

main();
