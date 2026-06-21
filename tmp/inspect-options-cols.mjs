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
  const opts = Array.from(document.querySelectorAll("td.mc-pdp-options-td"));
  const pickers = Array.from(document.querySelectorAll("#mc-saranoni-color-picker, .mc-saranoni-color-picker"));
  const feat = document.getElementById("mc-pdp-features");
  return {
    opts: opts.map((td, i) => ({
      i,
      w: Math.round(td.getBoundingClientRect().width),
      childIds: Array.from(td.children)
        .filter((c) => c.id)
        .map((c) => c.id),
      hasPicker: !!td.querySelector("#mc-saranoni-color-picker"),
      hasFeatures: !!td.querySelector("#mc-pdp-features"),
    })),
    pickers: pickers.map((p) => ({
      id: p.id,
      parent: p.parentElement?.id || p.parentElement?.className?.slice(0, 40),
      beforeFeatures: feat
        ? !!(p.compareDocumentPosition(feat) & Node.DOCUMENT_POSITION_FOLLOWING)
        : null,
    })),
    finalizeExists: typeof window.mcFinalizeSaranoniInfoColumnOrder === "function",
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
