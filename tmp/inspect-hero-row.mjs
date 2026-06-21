import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const urls = [
  "https://www.mccabestheaterandliving.com/product-p/sar-mnky-play-mat.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm",
];
const browser = await chromium.launch({ headless: true });
for (const url of urls) {
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
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(12000);
  const d = await page.evaluate(() => {
    const media = document.querySelector("td.mc-pdp-media-td");
    const opt = document.querySelector("td.mc-pdp-options-td");
    const main = document.querySelector("tr.mc-pdp-main-row");
    function info(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        parent: el.parentElement?.tagName,
        sameRow: !!(media && opt && media.parentElement === opt.parentElement),
      };
    }
    return {
      url: location.pathname,
      media: info(media),
      opt: info(opt),
      mainRowW: main ? Math.round(main.getBoundingClientRect().width) : 0,
      mainChildTds: main
        ? Array.from(main.children)
            .filter((c) => c.tagName === "TD")
            .map((td) => ({ cls: td.className.slice(0, 40), w: Math.round(td.getBoundingClientRect().width) }))
        : [],
    };
  });
  console.log(JSON.stringify(d, null, 2));
  await page.close();
}
await browser.close();
