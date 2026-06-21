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
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-mnky-play-mat.htm", {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(12000);
const d = await page.evaluate(() => {
  const media = document.querySelector("td.mc-pdp-media-td");
  const opt = document.querySelector("td.mc-pdp-options-td");
  function chain(el) {
    const out = [];
    let w = el;
    while (w && w.id !== "v65-product-parent") {
      out.push(w.tagName + (w.id ? "#" + w.id : "") + (w.className ? "." + w.className.split(" ")[0] : ""));
      w = w.parentElement;
    }
    return out;
  }
  return { mediaChain: chain(media), optChain: chain(opt) };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
