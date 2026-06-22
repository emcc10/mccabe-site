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
await page.waitForTimeout(12000);
const d = await page.evaluate(() => {
  function ids() {
    const col = document.querySelector("td.mc-pdp-options-td");
    return col
      ? Array.from(col.children)
          .filter((el) => el.id)
          .map((el) => el.id)
      : [];
  }
  const before = ids();
  if (typeof window.mcFinalizeSaranoniInfoColumnOrder === "function") {
    window.mcFinalizeSaranoniInfoColumnOrder();
  }
  const after = ids();
  const picker = document.getElementById("mc-saranoni-color-picker");
  const feat = document.getElementById("mc-pdp-features");
  return {
    before,
    after,
    pickerBeforeFeatures: picker && feat ? picker.compareDocumentPosition(feat) & Node.DOCUMENT_POSITION_FOLLOWING : null,
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
