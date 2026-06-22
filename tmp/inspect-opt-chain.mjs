import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route("**/mc-pdp-auth-cta-fix.js**", (r) =>
  r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(ROOT, "vspfiles/js/mc-pdp-auth-cta-fix.js"), "utf8") })
);
await page.route("**/custom-safe.css**", (r) =>
  r.fulfill({ status: 200, contentType: "text/css", body: fs.readFileSync(path.join(ROOT, "vspfiles/css/custom-safe.css"), "utf8") })
);
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-mnky-play-mat.htm", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(12000);
const d = await page.evaluate(() => {
  const opt = document.querySelector("td.mc-pdp-options-td");
  const chain = [];
  let w = opt;
  for (let i = 0; i < 12 && w; i++) {
    const r = w.getBoundingClientRect();
    const cs = getComputedStyle(w);
    chain.push({ tag: w.tagName, cls: (w.className || "").slice(0, 40), w: Math.round(r.width), display: cs.display, width: cs.width });
    w = w.parentElement;
  }
  return chain;
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
