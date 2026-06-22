/**
 * Live Saranoni PDP audit — price, swatches, layout, duplicate picker.
 * Usage: node scripts/audit_saranoni_pdp_playwright.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tmp", "saranoni-pdp-audit");
const LOCAL_JS = path.join(ROOT, "vspfiles", "js", "mc-pdp-auth-cta-fix.js");
const LOCAL_CSS = path.join(ROOT, "vspfiles", "css", "custom-safe.css");

const PAGES = [
  { name: "play-mat", url: "https://www.mccabestheaterandliving.com/product-p/sar-mnky-play-mat.htm", type: "color" },
  { name: "hp-icons", url: "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm", type: "size" },
  { name: "bean-bag-control", url: "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", type: "control" },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

for (const p of PAGES) {
  for (const vp of [
    { label: "desktop", width: 1280, height: 900 },
    { label: "mobile", width: 390, height: 844 },
  ]) {
    try {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.route("**/mc-pdp-auth-cta-fix.js**", (r) =>
      r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(LOCAL_JS, "utf8") })
    );
    await page.route("**/custom-safe.css**", (r) =>
      r.fulfill({ status: 200, contentType: "text/css", body: fs.readFileSync(LOCAL_CSS, "utf8") })
    );
    await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("#v65-product-parent, #product_photo", { timeout: 60000 });
    await page.waitForTimeout(12000);

    const audit = await page.evaluate((pageType) => {
      const isSar = document.body.classList.contains("mc-saranoni-pdp");
      const priceHosts = document.querySelectorAll("#mc-pdp-price-stack-host");
      const nativePrices = document.querySelectorAll(
        "#v65-product-parent .colors_pricebox .product_list_price, #v65-product-parent .colors_pricebox .product_productprice"
      );
      let visibleNativePrice = 0;
      nativePrices.forEach((n) => {
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        if (r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0") {
          visibleNativePrice++;
        }
      });
      const picker = document.querySelector("#mc-saranoni-color-picker, .mc-saranoni-color-picker");
      const wrap = document.getElementById("mc-configured-color-swatch-wrapper");
      const swatches = wrap
        ? Array.from(wrap.querySelectorAll(".mc-configured-color-swatch")).filter((b) => b.style.display !== "none")
        : [];
      const srcs = swatches.map((b) => {
        const img = b.querySelector("img");
        return img ? img.getAttribute("src") || "" : "";
      });
      const uniqueSrcs = new Set(srcs.filter(Boolean));
      const labelEl = document.getElementById("mc-configured-color-selected-name");
      const labelVisible = labelEl
        ? getComputedStyle(labelEl.closest(".mc-configured-color-swatch-label") || labelEl).display !== "none"
        : null;
      const feat = document.getElementById("mc-pdp-features");
      const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
      const featRect = feat ? feat.getBoundingClientRect() : null;
      const overlap =
        wrapRect && featRect
          ? wrapRect.bottom > featRect.top + 4 && wrapRect.top < featRect.bottom - 4 && wrapRect.right > featRect.left
          : false;
      const photo = document.getElementById("product_photo");
      const atc = document.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
      return {
        ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || "",
        isSar,
        ready: document.body.classList.contains("mc-saranoni-pdp-ready"),
        priceHostCount: priceHosts.length,
        visibleNativePrice,
        duplicatePicker: !!(picker && picker.getBoundingClientRect().height > 0),
        swatchCount: swatches.length,
        uniqueSwatchImages: uniqueSrcs.size,
        duplicateSwatchImages: srcs.length > uniqueSrcs.size,
        labelVisible,
        featuresOverlap: overlap,
        photoWidth: photo ? Math.round(photo.getBoundingClientRect().width) : 0,
        colWidth: document.querySelector("td.mc-pdp-options-td")
          ? Math.round(document.querySelector("td.mc-pdp-options-td").getBoundingClientRect().width)
          : 0,
        atcVisible: atc ? getComputedStyle(atc).visibility !== "hidden" : false,
        consoleErrors: window.__MC_AUDIT_ERRORS__ || [],
      };
    }, p.type);

    const shot = path.join(OUT, `${p.name}-${vp.label}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const pass =
      p.type === "control"
        ? !audit.isSar
        : audit.ver === "20260621saranoni9" &&
          audit.isSar &&
          audit.priceHostCount === 1 &&
          audit.visibleNativePrice === 0 &&
          !audit.duplicatePicker &&
          !audit.featuresOverlap &&
          audit.photoWidth >= 300 &&
          audit.colWidth >= 300 &&
          (p.type !== "color" || audit.swatchCount === 0 || audit.uniqueSwatchImages === audit.swatchCount);

    results.push({ page: p.name, viewport: vp.label, type: p.type, pass, ...audit });
    await page.close();
    } catch (err) {
      results.push({ page: p.name, viewport: vp.label, type: p.type, pass: false, error: String(err.message || err) });
    }
  }
}

fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));

console.log("\nSaranoni PDP audit results:\n");
console.log(
  "| Page | Viewport | Pass | Price | Native $ | Dup picker | Swatches | Unique imgs | Overlap |",
);
console.log("|------|----------|------|-------|----------|------------|----------|-------------|---------|");
for (const r of results) {
  console.log(
    `| ${r.page} | ${r.viewport} | ${r.pass ? "PASS" : "FAIL"} | ${r.priceHostCount} | ${r.visibleNativePrice} | ${r.duplicatePicker} | ${r.swatchCount} | ${r.uniqueSwatchImages} | ${r.featuresOverlap} |`
  );
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
process.exit(failed ? 1 : 0);
