import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route("**/mc-pdp-auth-cta-fix.js**", (r) =>
  r.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: fs.readFileSync(path.join(ROOT, "vspfiles/js/mc-pdp-auth-cta-fix.js"), "utf8"),
  })
);
await page.route("**/custom-safe.css**", (r) =>
  r.fulfill({
    status: 200,
    contentType: "text/css",
    body: fs.readFileSync(path.join(ROOT, "vspfiles/css/custom-safe.css"), "utf8"),
  })
);
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-mnky-play-mat.htm", {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(15000);
const d = await page.evaluate(() => {
  const row = document.querySelector("tr.mc-pdp-main-row");
  const table = document.getElementById("v65-product-parent");
  const col = document.querySelector("td.mc-pdp-options-td");
  const chain = [];
  let w = row;
  while (w && w !== document.body) {
    const r = w.getBoundingClientRect();
    chain.push({
      tag: w.tagName,
      id: w.id || "",
      w: Math.round(r.width),
      display: getComputedStyle(w).display,
    });
    w = w.parentElement;
  }
  return {
    tableW: table ? Math.round(table.getBoundingClientRect().width) : 0,
    colW: col ? Math.round(col.getBoundingClientRect().width) : 0,
    cssHref: document.querySelector('link[href*="custom-safe"]')?.href || "none",
    sarCss: !!document.getElementById("mc-saranoni-pdp-layout-css"),
    chain,
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
