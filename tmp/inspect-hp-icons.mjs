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
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm", {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(15000);
const d = await page.evaluate(() => {
  const row = document.querySelector("tr.mc-pdp-main-row");
  const col = document.querySelector("td.mc-pdp-options-td");
  const media = document.querySelector("td.mc-pdp-media-td");
  const photo = document.getElementById("product_photo");
  return {
    rowW: row ? Math.round(row.getBoundingClientRect().width) : 0,
    colW: col ? Math.round(col.getBoundingClientRect().width) : 0,
    mediaW: media ? Math.round(media.getBoundingClientRect().width) : 0,
    photoW: photo ? Math.round(photo.getBoundingClientRect().width) : 0,
    rowDisplay: row ? getComputedStyle(row).display : "",
    ids: col
      ? Array.from(col.children)
          .filter((c) => c.id)
          .map((c) => c.id)
      : [],
  };
});
console.log(JSON.stringify(d, null, 2));
await page.screenshot({ path: "tmp/saranoni-pdp-verify/hp-icons-check.png" });
await browser.close();
