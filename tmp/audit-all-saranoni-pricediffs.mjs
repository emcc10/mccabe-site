import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("catalog/saranoni-gap-report");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function collectSarLinks() {
  const urls = new Set();
  // Saranoni category + search fallbacks
  const seeds = [
    "https://www.mccabestheaterandliving.com/saranoni-blankets-s/196.htm",
    "https://www.mccabestheaterandliving.com/category-s/196.htm",
    "https://www.mccabestheaterandliving.com/searchresults.asp?Search=SAR-",
  ];
  for (const seed of seeds) {
    try {
      await page.goto(seed, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);
      const found = await page.evaluate(() =>
        [...document.querySelectorAll("a[href*='product-p/sar-'], a[href*='ProductDetails.asp']")]
          .map((a) => a.href)
          .filter((h) => /sar-/i.test(h) || /ProductCode=SAR-/i.test(h))
      );
      found.forEach((u) => urls.add(u.split("#")[0]));
      // pagination
      const pages = await page.evaluate(() =>
        [...document.querySelectorAll("a[href*='-s/196'], a[href*='cat=196'], a[href*='Page=']")]
          .map((a) => a.href)
          .slice(0, 20)
      );
      for (const p of pages.slice(0, 12)) {
        try {
          await page.goto(p, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(1200);
          const more = await page.evaluate(() =>
            [...document.querySelectorAll("a[href*='product-p/sar-']")].map((a) => a.href.split("#")[0])
          );
          more.forEach((u) => urls.add(u));
        } catch {}
      }
    } catch (e) {
      console.log("seed fail", seed, e.message);
    }
  }
  return [...urls];
}

async function scrapeProduct(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const code =
      document.querySelector('input[name="ProductCode"],input[name="productcode"]')?.value || "";
    const name =
      document.querySelector("h1, #ProductName, .productname")?.textContent?.replace(/\s+/g, " ").trim() ||
      "";
    const basePriceText =
      document.querySelector("#price_div, .product_productprice, [itemprop=price]")?.textContent || "";
    const baseMatch = basePriceText.match(/([\d,]+\.\d{2}|\d+)/);
    const basePrice = baseMatch ? parseFloat(baseMatch[1].replace(/,/g, "")) : null;
    const opts = [];
    document.querySelectorAll("#options_table select").forEach((sel) => {
      const row = sel.closest("tr");
      const cat =
        row?.querySelector("td")?.textContent?.replace(/\s+/g, " ").trim() ||
        sel.getAttribute("name") ||
        "";
      [...sel.options].forEach((o) => {
        if (!o.value) return;
        const text = o.textContent.replace(/\s+/g, " ").trim();
        const m = text.match(/Additional\s*\$\s*([\d,]+\.?\d*)/i);
        const amt = m ? parseFloat(m[1].replace(/,/g, "")) : 0;
        opts.push({
          category: cat,
          optionId: o.value,
          text,
          pricediff: amt,
        });
      });
    });
    return { code, name, url: location.href, basePrice, opts };
  });
}

const links = await collectSarLinks();
console.log("found links", links.length);

// Always include known baby / problem slugs
const extras = [
  "sar-wearable",
  "sar-stretchy-swaddles-hats",
  "sar-baby-bmb-lite-sets",
  "sar-bmb-hats",
  "sar-bmb-socks",
  "sar-bmb-tod",
  "sar-bmb-sets",
  "sar-dream-tod",
  "sar-satin-back-tod",
  "sar-satin-border-tod",
  "sar-lush-mini",
  "sar-lush-rcv",
  "sar-snuggler",
  "sar-jl-jl-snuggler",
  "sar-elf-snuggler",
  "sar-cozy-bmb-robes",
  "sar-grand-fx-fur",
  "sar-stuffed-animals",
  "sar-stuffed-anml-lvys",
  "sar-stuffed-anml-rockers",
  "sar-saucer-chair",
  "sar-snuggle-up-chair",
  "sar-mnky-play-mat",
  "sar-hp-hp-icons-mnky-lush",
  "sar-hp-hp-msln-nrs",
  "sar-ptr-rbt-cotton-msln",
  "sar-ptr-rbt-bmbu-ryn-msln",
  "sar-batman-mnky-lush",
  "sar-superman-mnky-lush",
];
for (const slug of extras) {
  links.push(`https://www.mccabestheaterandliving.com/product-p/${slug}.htm`);
}

const uniq = [...new Set(links)];
const rows = [];
const high = [];

for (const url of uniq) {
  try {
    const info = await scrapeProduct(url);
    if (!info.code || !/^SAR-/i.test(info.code)) continue;
    console.log(info.code, "opts", info.opts.length, "base", info.basePrice);
    for (const o of info.opts) {
      const row = {
        ProductCode: info.code,
        ProductName: info.name,
        Url: info.url,
        BasePrice: info.basePrice ?? "",
        OptionCategory: o.category,
        OptionID: o.optionId,
        OptionText: o.text,
        LivePriceDiff: o.pricediff,
      };
      rows.push(row);
      if (o.pricediff >= 50) {
        high.push(row);
        console.log("  HIGH", o.pricediff, o.text, "id", o.optionId);
      }
    }
  } catch (e) {
    console.log("fail", url, e.message);
  }
}

function toCsv(list) {
  if (!list.length) return "ProductCode\n";
  const keys = Object.keys(list[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...list.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

fs.writeFileSync(path.join(OUT, "saranoni_live_all_option_pricediffs.csv"), toCsv(rows));
high.sort((a, b) => b.LivePriceDiff - a.LivePriceDiff);
fs.writeFileSync(path.join(OUT, "saranoni_live_high_pricediffs.csv"), toCsv(high));
console.log("TOTAL option rows", rows.length);
console.log("HIGH (>=$50)", high.length);
console.log(
  "TOP",
  high.slice(0, 30).map((h) => `${h.ProductCode} ${h.LivePriceDiff} ${h.OptionText}`)
);
await browser.close();
