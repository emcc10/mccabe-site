import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localJs = fs.readFileSync(
  path.join(__dirname, "../vspfiles/js/mc-pdp-auth-cta-fix.js"),
  "utf8"
);

const PAGES = [
  {
    name: "boy-who-lived",
    url: "https://www.mccabestheaterandliving.com/product-p/sar-boy-who-lived-dbl-layer.htm",
    type: "layout",
  },
  {
    name: "faux-fur-king",
    url: "https://www.mccabestheaterandliving.com/product-p/sar-grand-faux-fur-throw-blanket.htm",
    type: "color",
  },
  {
    name: "ruched-throw",
    url: "https://www.mccabestheaterandliving.com/product-p/sar-ruched-minky-throw-blanket.htm",
    type: "size",
  },
  {
    name: "non-saranoni",
    url: "https://www.mccabestheaterandliving.com/product-p/palliser-41417-custom-theater-seating.htm",
    type: "control",
  },
];

const ORDER_IDS = [
  "mc-pdp-brand-logo",
  "mc-pdp-title-right",
  "mc-pdp-price-stack-host",
  "mc-configured-color-swatch-wrapper",
  "mc-saranoni-size-thumbs",
  "mc-pdp-option-block",
  "mc-pdp-purchase-stack",
  "messaging-element",
  "mc-pdp-accordion",
];

async function evaluatePage(page) {
  return page.evaluate((orderIds) => {
    const infoCol = document.querySelector("td.mc-pdp-options-td, td.mc-unified-pdp-info");
    const img = document.getElementById("product_photo");
    const ir = img ? img.getBoundingClientRect() : null;
    const order = [];
    if (infoCol) {
      orderIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el && infoCol.contains(el)) order.push(id);
      });
    }
    const stack = document.getElementById("mc-pdp-purchase-stack");
    const acc = document.getElementById("mc-pdp-accordion");
    const stackIdx = stack && infoCol ? Array.prototype.indexOf.call(infoCol.children, stack) : -1;
    const accIdx = acc && infoCol ? Array.prototype.indexOf.call(infoCol.children, acc) : -1;
    const swatches = Array.from(
      document.querySelectorAll("#mc-configured-color-swatch-wrapper .mc-configured-color-swatch")
    ).map((btn) => ({
      label: btn.getAttribute("data-label") || btn.getAttribute("title") || "",
      optionId: btn.getAttribute("data-option-id") || "",
      img: (btn.querySelector("img") && btn.querySelector("img").getAttribute("src")) || "",
      textOnly: btn.classList.contains("mc-saranoni-text-swatch"),
    }));
    const altviews = document.getElementById("altviews");
    return {
      isSaranoni: document.body.classList.contains("mc-saranoni-pdp"),
      imgW: ir ? Math.round(ir.width) : 0,
      imgH: ir ? Math.round(ir.height) : 0,
      order,
      stackBeforeAccordion: stackIdx >= 0 && accIdx >= 0 ? stackIdx < accIdx : null,
      swatches,
      altviewsVisible: !!(altviews && altviews.offsetParent !== null),
      heroSrc: img ? img.getAttribute("src") : "",
      productCode: (document.querySelector('input[name="ProductCode"]') || {}).value || "",
    };
  }, ORDER_IDS);
}

async function clickSwatchAndCheck(page, index) {
  return page.evaluate(async (idx) => {
    const btns = Array.from(
      document.querySelectorAll("#mc-configured-color-swatch-wrapper .mc-configured-color-swatch")
    ).filter((b) => b.style.display !== "none");
    const btn = btns[idx];
    if (!btn) return null;
    const before = document.getElementById("product_photo").getAttribute("src");
    btn.click();
    await new Promise((r) => setTimeout(r, 900));
    return {
      label: btn.getAttribute("data-label") || "",
      optionId: btn.getAttribute("data-option-id") || "",
      before,
      after: document.getElementById("product_photo").getAttribute("src"),
      selectedName: (document.getElementById("mc-configured-color-selected-name") || {}).textContent || "",
    };
  }, index);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const results = {};

for (const spec of PAGES) {
  const page = await context.newPage();
  await page.route("**/mc-pdp-auth-cta-fix.js**", (route) => {
    route.fulfill({ status: 200, contentType: "application/javascript", body: localJs });
  });
  await page.goto(spec.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#product_photo", { timeout: 45000 }).catch(() => null);
  await page.waitForTimeout(6000);
  const data = await evaluatePage(page);
  results[spec.name] = { url: spec.url, type: spec.type, ...data };

  if (spec.type === "color" && data.swatches.length > 1) {
    const clicks = [];
    for (let i = 0; i < Math.min(data.swatches.length, 3); i++) {
      clicks.push(await clickSwatchAndCheck(page, i));
    }
    results[spec.name].swatchClicks = clicks;
    const urls = clicks.map((c) => c && c.after).filter(Boolean);
    results[spec.name].distinctHeroUrls = new Set(urls).size;
  }

  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));

const boy = results["boy-who-lived"];
const color = results["faux-fur-king"];
const ok =
  boy &&
  boy.imgW >= 200 &&
  boy.stackBeforeAccordion === true &&
  boy.order.indexOf("mc-pdp-purchase-stack") < boy.order.indexOf("mc-pdp-accordion") &&
  results["non-saranoni"] &&
  !results["non-saranoni"].isSaranoni;

process.exit(ok ? 0 : 1);
