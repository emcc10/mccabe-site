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
  const media = document.querySelector("td.mc-pdp-media-td");
  const main = document.querySelector("tr.mc-pdp-main-row");
  function chain(el) {
    const out = [];
    let w = el;
    while (w && w !== document.body) {
      const r = w.getBoundingClientRect();
      const cs = getComputedStyle(w);
      out.push({
        tag: w.tagName,
        id: w.id || "",
        cls: (w.className || "").slice(0, 50),
        w: Math.round(r.width),
        display: cs.display,
        width: cs.width,
        flex: cs.flex,
        flexBasis: cs.flexBasis,
        tableLayout: cs.tableLayout,
      });
      w = w.parentElement;
    }
    return out;
  }
  const wrappers = main
    ? Array.from(main.children)
        .filter((c) => c.tagName === "TD")
        .map((td) => ({
          w: Math.round(td.getBoundingClientRect().width),
          innerTable: td.querySelector(":scope > table")
            ? Math.round(td.querySelector(":scope > table").getBoundingClientRect().width)
            : null,
          chain: chain(td.querySelector("td.mc-pdp-media-td, td.mc-pdp-options-td") || td),
        }))
    : [];
  return { mediaChain: chain(media), wrappers, hasLayoutCss: !!document.getElementById("mc-saranoni-pdp-layout-css") };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
