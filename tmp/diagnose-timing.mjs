import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const LOCAL_JS = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "vspfiles", "js", "mc-pdp-auth-cta-fix.js");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.route("**/mc-pdp-auth-cta-fix.js**", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(LOCAL_JS, "utf8") });
});

await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm", { waitUntil: "domcontentloaded", timeout: 60000 });

for (const ms of [500, 2000, 5000, 10000, 15000]) {
  await page.waitForTimeout(ms === 500 ? 500 : ms - (ms === 2000 ? 500 : ms === 5000 ? 2000 : ms === 10000 ? 5000 : 10000));
  const snap = await page.evaluate(() => ({
    t: Date.now(),
    optionsTable: !!document.getElementById("options_table"),
    optBlock: !!document.getElementById("mc-pdp-option-block"),
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
  }));
  console.log(ms + "ms", JSON.stringify(snap));
}
await browser.close();
