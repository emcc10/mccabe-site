import { chromium } from "playwright";

const codes = [
  "sar-wearable",
  "sar-lush",
  "sar-lush-mini",
  "sar-lush-xl-lg",
  "sar-bmb-tod",
  "sar-fx-fur",
  "sar-mnky-lush",
  "sar-wfl-knt",
  "sar-cozy-bmb-robes",
  "sar-grand-fx-fur-robes",
  "sar-wfl-knt-robes",
  "sar-mnky-str",
  "sar-mnky-str-luxe-robes",
  "sar-snuggler",
  "sar-saucer-chair",
  "sar-bamboni-toddler-blanket",
  "sar-fx-fur-king",
  "sar-fx-fur-full-queen",
  "sar-ribbed-bmb",
  "sar-grand-fx-fur",
  "sar-bmb-snuggler",
  "sar-stretchy-swaddles-hats",
  "sar-stuffed-animals",
  "sar-hp-hp-icons-mnky-lush",
  "sar-jl-jl-snuggler",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function getOptions(slug) {
  const url = `https://www.mccabestheaterandliving.com/product-p/${slug}.htm`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  return page.evaluate(() => {
    const code =
      document.querySelector('input[name="ProductCode"],input[name="productcode"]')?.value ||
      "";
    const opts = [];
    document.querySelectorAll("#options_table select option, #options_table option").forEach((o) => {
      if (!o.value) return;
      const sel = o.closest("select");
      const row = sel?.closest("tr");
      const label =
        row?.querySelector("td")?.textContent?.trim() ||
        sel?.getAttribute("name") ||
        "";
      opts.push({ label, text: o.textContent.replace(/\s+/g, " ").trim(), value: o.value });
    });
    const seen = new Set();
    const uniq = [];
    for (const o of opts) {
      const k = `${o.value}|${o.text}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(o);
    }
    const swatchImgs = [
      ...document.querySelectorAll(
        "#mc-configured-color-swatch-wrapper img, .mc-configured-color-swatch img, #altviews img"
      ),
    ].map((i) => i.getAttribute("src") || "");
    return { code, opts: uniq, swatchImgs };
  });
}

const bad = [];
const wearableDetail = await getOptions("sar-wearable");
console.log(JSON.stringify({ wearableDetail }, null, 2));

for (const c of codes) {
  try {
    const info = await getOptions(c);
    const flagged = info.opts
      .map((o) => {
        const m = o.text.match(/Additional\s*\$\s*([\d,.]+)/i);
        if (!m) return null;
        const amt = parseFloat(m[1].replace(/,/g, ""));
        if (!(amt >= 20)) return null;
        return { ...o, amt };
      })
      .filter(Boolean);
    if (flagged.length) {
      bad.push({ code: info.code || c, flagged });
      console.log(
        c,
        "FLAGGED",
        flagged.map((f) => `${f.text} => ${f.value}`).join(" | ")
      );
    } else {
      console.log(c, "ok", info.opts.length, "opts");
    }
  } catch (e) {
    console.log("fail", c, e.message);
  }
}

console.log("SUMMARY_BAD", JSON.stringify(bad, null, 2));
await browser.close();
