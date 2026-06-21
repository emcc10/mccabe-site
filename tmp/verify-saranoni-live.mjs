import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL =
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm";
const OUT = path.join(ROOT, "tmp", "saranoni-pdp-verify");

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector("#v65-product-parent, #product_photo", { timeout: 60000 });
await page.waitForTimeout(15000);

const audit = await page.evaluate(() => {
  const col = document.querySelector("td.mc-pdp-options-td");
  const ids = col
    ? Array.from(col.children)
        .filter((el) => el.id)
        .map((el) => ({
          id: el.id,
          top: Math.round(el.getBoundingClientRect().top),
          vis: getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none",
        }))
    : [];
  const feat = ids.find((x) => x.id === "mc-pdp-features");
  const opt = ids.find((x) => x.id === "mc-pdp-option-block");
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || "",
    script: Array.from(document.querySelectorAll('script[src*="mc-pdp-auth-cta-fix"]'))
      .map((s) => s.src)
      .join("|"),
    ids,
    sizeBeforeFeatures: feat && opt ? opt.top > feat.top : null,
    domOrderOk: feat && opt ? ids.indexOf(feat) > ids.indexOf(opt) : null,
  };
});

fs.writeFileSync(path.join(OUT, "live-audit.json"), JSON.stringify(audit, null, 2));
await page.screenshot({ path: path.join(OUT, "live-native.png"), fullPage: false });
console.log(JSON.stringify(audit, null, 2));
await browser.close();
