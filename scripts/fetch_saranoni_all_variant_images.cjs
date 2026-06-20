#!/usr/bin/env node
/**
 * Download all Saranoni variant T/S images from Shopify (per product + color).
 * Falls back to McCabe default hero (-2T.jpg) when no Shopify variant image exists.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const sharp = require("sharp");

const DL = path.join(process.env.USERPROFILE || "", "Downloads");
const DETAIL = path.join(DL, "Volusion_Saranoni_Products_OptionIDs_Import_Detail.csv");
const ASSIGN = path.join(DL, "saranoni_verified_color_assignments.csv");
const OUT = path.join(DL, "Saranoni_Variant_Images_Upload_Batch");
const REPORT = path.join(DL, "Saranoni_Variant_Images_Download_Report.csv");
const CDN = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/";
const MAIN_MAX = 1946;
const SWATCH = 320;

const CODE_TO_HANDLE = {
  "SAR-DBL-RCH-FX-FUR": "ruched-minky-throw-blanket",
  "SAR-DBL-RCH-FX-FUR-XL-LG": "ruched-minky-extra-large-throw-blanket",
  "SAR-LUSH": "lush-throw-blankets",
  "SAR-LUSH-XL-LG": "lush-extra-large-blanket",
  "SAR-LUSH-TOD": "lush-toddler-blanket",
  "SAR-LUSH-MINI": "lush-mini-blanket",
  "SAR-LUSH-RCV": "lush-receiving-blanket",
  "SAR-CHNK-KNT-LG": "chunky-knit-large-throw",
  "SAR-CHNL-FRNG-XL-LG": "chenille-fringe-xl-throw-blankets",
  "SAR-MNKY-STR": "minky-stretch-throw-blankets",
  "SAR-MNKY-LUSH-XL-LG": "minky-lush-xl-blankets",
  "SAR-MNKY-LUSH-TOD": "minky-lush-toddler-blankets",
  "SAR-MNKY-LUSH": "minky-lush-throw-blankets",
  "SAR-BMBU-RYN-MSLN-XL-LG-4": "bamboo-rayon-muslin-extra-large-4-layer-quilt",
  "SAR-BMBU-RYN-MSLN-QUEEN-KING": "bamboo-rayon-muslin-queen-king-4-layer-quilt",
  "SAR-BMBU-RYN-MSLN-PILLOWCA": "bamboo-rayon-muslin-pillowcase-set",
  "SAR-GRAND-FX-FUR": "grand-faux-fur-throw-blankets-new",
  "SAR-GRAND-FX-FUR-XL-LG": "grand-faux-fur-xl-throw-blankets-new",
  "SAR-GRAND-FX-FUR-KING": "grand-faux-fur-king-blanket",
  "SAR-GRAND-FX-FUR-QUEEN": "grand-faux-fur-queen-blanket",
  "SAR-GRAND-FX-FUR-12X20": "grand-faux-fur-12x20-pillow-cover",
  "SAR-GRAND-FX-FUR-2-PACK-EURO": "grand-faux-fur-2-pack-euro-pillow-covers",
  "SAR-RIBBED-BMB": "ribbed-bamboni-throw-blanket",
  "SAR-RIBBED-BMB-XL-LG": "ribbed-bamboni-extra-large-blanket",
  "SAR-RIBBED-BMB-QUEEN-KING": "ribbed-bamboni-king-blanket",
  "SAR-WFL-KNT": "waffle-knit-throw-blankets-1",
  "SAR-WFL-KNT-XL-LG": "waffle-knit-throw-blankets",
  "SAR-WFL-KNT-KING": "waffle-knit-king-blankets",
  "SAR-WFL-KNT-QUEEN": "waffle-knit-queen-blankets",
  "SAR-WFL-KNT-TWIN": "waffle-knit-twin-blankets",
  "SAR-WFL-KNT-TOD": "waffle-knit-toddler-blankets",
  "SAR-WFL-KNT-ROBES": "waffle-knit-robes",
  "SAR-COZY-BMB-ROBES": "cozy-bamboni-robe",
  "SAR-BMB-SETS": "bamboni-sets",
  "SAR-BMB-HATS": "bamboni-hat",
  "SAR-BMB-SOCKS": "bamboni-socks",
  "SAR-BMB-TOD": "bamboni-toddler-blanket",
  "SAR-BMB-TWIN": "bamboni-twin-blankets",
  "SAR-BMB-SNUGGLER": "bamboni-snuggler",
  "SAR-SNUGGLER": "snuggler",
  "SAR-DBL-LAYER-BMB-TOD": "double-layer-bamboni-toddler-blanket",
  "SAR-MNKY-STR-LUXE-ROBES": "minky-stretch-luxe-robes",
  "SAR-PTRN-FX-FUR-XL-LG": "patterned-faux-fur-extra-large-throw-blanket",
  "SAR-MNKY-PLAY-MAT": "playmat",
  "SAR-WEARABLE": "wearable-blanket",
  "SAR-MARBLE-FX-FUR-MNKY-XL-LG": "marble-faux-fur-minky-extra-large-throw-blanket",
};

const HANDLE_ALIASES = {
  "grand-faux-fur-throw-blankets": "grand-faux-fur-throw-blankets-new",
  "minky-lush-throw-blankets": "minky-lush-xl-blankets",
};

const COLOR_ALIASES = {
  cameo: "buff",
  golden: "copper",
  oatmeal: "dove",
  sunkissed: "sun-kissed",
  allspice: "cameo",
  nightfalldoublelayer: "nightfall",
  pansydoublelayer: "pansy",
  graymarble: "gray mink",
  tanmarble: "fawn",
};

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

function normColor(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function handleFromUrl(url) {
  const m = String(url || "").match(/\/products\/([^/?#]+)/i);
  return m ? m[1] : "";
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
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
      .on("error", reject);
  });
}

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchBuf(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

function shopifyImageUrl(src, width) {
  if (!src) return "";
  const base = src.split("?")[0];
  return `${base}?width=${width}`;
}

function findVariantImage(product, colorName) {
  const variants = product.variants || [];
  const images = product.images || [];
  const byId = new Map(images.map((img) => [img.id, img.src]));
  const keys = [normColor(colorName), normColor(COLOR_ALIASES[normColor(colorName)] || "")];
  let variant = null;
  for (const v of variants) {
    const o1 = normColor(v.option1);
    if (keys.includes(o1)) {
      variant = v;
      break;
    }
  }
  if (!variant) {
    for (const v of variants) {
      const o1 = normColor(v.option1);
      if (keys.some((k) => k && (o1.includes(k) || k.includes(o1)))) {
        variant = v;
        break;
      }
    }
  }
  if (variant && variant.image_id && byId.has(variant.image_id)) {
    return { src: byId.get(variant.image_id), source: "shopify-variant", shopifyColor: variant.option1 };
  }
  if (images[0]?.src) {
    return { src: images[0].src, source: "shopify-featured", shopifyColor: "" };
  }
  return null;
}

async function savePair(buf, tPath, sPath) {
  const tBuf = await sharp(buf)
    .rotate()
    .resize({ width: MAIN_MAX, height: MAIN_MAX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 93, mozjpeg: true })
    .toBuffer();
  const sBuf = await sharp(tBuf)
    .resize(SWATCH, SWATCH, { fit: "cover", position: "centre" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  fs.writeFileSync(tPath, tBuf);
  fs.writeFileSync(sPath, sBuf);
  return {
    tHash: crypto.createHash("md5").update(tBuf).digest("hex"),
    tBytes: tBuf.length,
    sBytes: sBuf.length,
  };
}

async function resolveHandle(productCode, urlByCode) {
  const fromUrl = handleFromUrl(urlByCode.get(productCode) || "");
  const candidates = [];
  if (fromUrl) candidates.push(HANDLE_ALIASES[fromUrl] || fromUrl);
  const mapped = CODE_TO_HANDLE[productCode];
  if (mapped && !candidates.includes(mapped)) candidates.push(mapped);
  for (const h of candidates) {
    try {
      const data = await fetchJson(`https://saranoni.com/products/${encodeURIComponent(h)}.json`);
      if (data.product) return { handle: h, product: data.product };
    } catch (_) {}
  }
  return null;
}

async function fetchMcCabeDefault(productCode) {
  for (const file of [`${productCode}-2T.jpg`, `${productCode}-T.jpg`]) {
    try {
      const buf = await fetchBuf(CDN + encodeURIComponent(file));
      if (buf.length > 1000) return { buf, source: "mccabe-default", file };
    } catch (_) {}
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const detail = parseCsv(fs.readFileSync(DETAIL, "utf8"));
  const assign = parseCsv(fs.readFileSync(ASSIGN, "utf8").replace(/^\uFEFF/, ""));
  const urlByCode = new Map();
  for (const r of assign) {
    if (!urlByCode.has(r.ProductCode)) urlByCode.set(r.ProductCode, r.SourceURL || "");
  }

  const byProduct = new Map();
  for (const r of detail) {
    const pc = r.ProductCode;
    if (!byProduct.has(pc)) byProduct.set(pc, []);
    byProduct.get(pc).push(r);
  }

  const report = [];
  let ok = 0,
    fallback = 0,
    fail = 0;

  for (const [productCode, colors] of [...byProduct.entries()].sort()) {
    process.stdout.write(`  ${productCode} (${colors.length} colors)\n`);
    const hit = await resolveHandle(productCode, urlByCode);
    let defaultBuf = null;
    if (!hit) {
      defaultBuf = await fetchMcCabeDefault(productCode);
    }

    for (const row of colors) {
      const oid = row.OptionID;
      const color = row.ColorName;
      const tName = `${productCode}-${oid}-T.jpg`;
      const sName = `${productCode}-${oid}-S.jpg`;
      const tPath = path.join(OUT, tName);
      const sPath = path.join(OUT, sName);
      let imageMeta = null;
      let source = "failed";

      if (hit) {
        imageMeta = findVariantImage(hit.product, color);
      }
      try {
        if (imageMeta?.src) {
          const buf = await fetchBuf(shopifyImageUrl(imageMeta.src, MAIN_MAX));
          const meta = await savePair(buf, tPath, sPath);
          source = imageMeta.source;
          ok++;
          report.push({
            ProductCode: productCode,
            ColorName: color,
            OptionID: oid,
            T_File: tName,
            S_File: sName,
            Source: source,
            ShopifyColor: imageMeta.shopifyColor || "",
            Status: "OK",
            T_Bytes: meta.tBytes,
            T_MD5: meta.tHash,
          });
        } else {
          if (!defaultBuf) defaultBuf = await fetchMcCabeDefault(productCode);
          if (defaultBuf) {
            const meta = await savePair(defaultBuf.buf, tPath, sPath);
            source = defaultBuf.source + "+main-fallback";
            fallback++;
            report.push({
              ProductCode: productCode,
              ColorName: color,
              OptionID: oid,
              T_File: tName,
              S_File: sName,
              Source: source,
              ShopifyColor: "",
              Status: "FALLBACK_MAIN",
              T_Bytes: meta.tBytes,
              T_MD5: meta.tHash,
            });
          } else {
            fail++;
            report.push({
              ProductCode: productCode,
              ColorName: color,
              OptionID: oid,
              T_File: tName,
              S_File: sName,
              Source: "none",
              ShopifyColor: "",
              Status: "FAILED",
              T_Bytes: "",
              T_MD5: "",
            });
          }
        }
      } catch (err) {
        fail++;
        report.push({
          ProductCode: productCode,
          ColorName: color,
          OptionID: oid,
          T_File: tName,
          S_File: sName,
          Source: "error",
          ShopifyColor: "",
          Status: `ERROR: ${err.message}`,
          T_Bytes: "",
          T_MD5: "",
        });
      }
    }
    await sleep(200);
  }

  const headers = [
    "ProductCode",
    "ColorName",
    "OptionID",
    "T_File",
    "S_File",
    "Source",
    "ShopifyColor",
    "Status",
    "T_Bytes",
    "T_MD5",
  ];
  const lines = [headers.join(",")];
  for (const r of report) {
    lines.push(headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","));
  }
  fs.writeFileSync(REPORT, lines.join("\r\n") + "\r\n", "utf8");

  console.log(`\nOutput folder: ${OUT}`);
  console.log(`Report: ${REPORT}`);
  console.log(`OK (Shopify variant/featured): ${ok}`);
  console.log(`Fallback (matches main/default hero): ${fallback}`);
  console.log(`Failed: ${fail}`);
  console.log(`Upload all T/S pairs to Volusion /v/vspfiles/photos/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
