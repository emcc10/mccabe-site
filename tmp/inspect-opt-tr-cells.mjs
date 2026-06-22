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
  const tr = opt?.parentElement;
  const title = document.getElementById("mc-pdp-title-right");
  return {
    trCells: tr
      ? Array.from(tr.children).map((c) => ({
          tag: c.tagName,
          cls: (c.className || "").slice(0, 40),
          w: Math.round(c.getBoundingClientRect().width),
          display: getComputedStyle(c).display,
        }))
      : [],
    titleW: title ? Math.round(title.getBoundingClientRect().width) : 0,
    optW: opt ? Math.round(opt.getBoundingClientRect().width) : 0,
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
