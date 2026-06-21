import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL =
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm";
const OUT = path.join(ROOT, "tmp", "saranoni-pdp-verify");
const LOCAL_JS = path.join(ROOT, "vspfiles", "js", "mc-pdp-auth-cta-fix.js");
const EXPECTED_ORDER = [
  "mc-pdp-brand-logo",
  "mc-pdp-title-right",
  "mc-pdp-price-stack-host",
  "messaging-element",
  "mc-pdp-option-block",
  "mc-pdp-features",
  "mc-pdp-description-below-features",
  "mc-pdp-purchase-stack",
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.route("**/mc-pdp-auth-cta-fix.js**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: fs.readFileSync(LOCAL_JS, "utf8"),
  });
});

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#v65-product-parent, #product_photo", { timeout: 60000 });
  await page.waitForTimeout(12000);
  await page.locator("#mc-pdp-brand-logo").scrollIntoViewIfNeeded().catch(function () {});

  const audit = await page.evaluate((expected) => {
    const col = document.querySelector("td.mc-pdp-options-td");
    const visibleIds = col
      ? Array.from(col.children)
          .filter((el) => {
            if (!el.id) return false;
            const st = getComputedStyle(el);
            return st.display !== "none" && st.visibility !== "hidden";
          })
          .map((el) => el.id)
      : [];
    const idx = {};
    expected.forEach((id) => {
      idx[id] = visibleIds.indexOf(id);
    });
    let orderOk = true;
    let last = -1;
    expected.forEach((id) => {
      const i = idx[id];
      if (i === -1) return;
      if (i < last) orderOk = false;
      last = i;
    });
    const rects = {};
    expected.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const r = el.getBoundingClientRect();
      rects[id] = { top: Math.round(r.top), left: Math.round(r.left), h: Math.round(r.height) };
    });
    const colText = col ? (col.textContent || "").replace(/\s+/g, " ") : "";
    const msg = document.getElementById("messaging-element");
    return {
      ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || "",
      visibleIds,
      idx,
      orderOk,
      rects,
      messagingInCol: !!(msg && col && col.contains(msg)),
      strayPrice: /price with selected options/i.test(colText),
      stackedPriceLabels: (colText.match(/\bPRICE\b/g) || []).length,
      hasSizeBlock: !!document.querySelector("#mc-pdp-option-block select[name*='___58']"),
      hasThumbs: !!document.getElementById("mc-saranoni-size-thumbs"),
      thumbInMedia: !!document.querySelector("td.mc-pdp-media-td #mc-saranoni-size-thumbs"),
      optionsTable: !!document.getElementById("options_table"),
    };
  }, EXPECTED_ORDER);

  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(audit, null, 2));
  await page.screenshot({ path: path.join(OUT, "desktop-fixed.png"), fullPage: false });

  const pass =
    audit.orderOk &&
    audit.messagingInCol &&
    !audit.strayPrice &&
    audit.stackedPriceLabels <= 1 &&
    audit.hasSizeBlock &&
    audit.hasThumbs &&
    audit.thumbInMedia &&
    audit.optionsTable &&
    audit.rects["mc-pdp-brand-logo"] &&
    audit.rects["mc-pdp-price-stack-host"] &&
    audit.rects["mc-pdp-brand-logo"].top < audit.rects["mc-pdp-price-stack-host"].top &&
    (!audit.rects["messaging-element"] ||
      audit.rects["messaging-element"].top > audit.rects["mc-pdp-price-stack-host"].top);

  console.log(JSON.stringify(audit, null, 2));
  if (!pass) {
    console.error("FAIL: Saranoni PDP layout audit");
    process.exitCode = 1;
  } else {
    console.log("PASS: Saranoni PDP layout audit");
  }

  const xl = page.locator('.mc-saranoni-size-thumb[title="XL"]');
  if (await xl.count()) {
    await xl.first().click();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => ({
      price:
        document.querySelector(
          "#mc-pdp-price-stack-host .mc-pdp-stack-retail-amt, #mc-pdp-price-stack-host .product_list_price, #mc-pdp-price-stack-host [itemprop='price']"
        )?.textContent?.trim() || "",
      heroLoading: /loading/i.test(document.getElementById("product_photo_td")?.textContent || ""),
    }));
    fs.writeFileSync(path.join(OUT, "after-xl.json"), JSON.stringify(after, null, 2));
    await page.screenshot({ path: path.join(OUT, "desktop-xl-fixed.png"), fullPage: false });
    if (!/\$179/.test(after.price)) {
      console.error("FAIL: XL price expected ~$179, got", after.price);
      process.exitCode = 1;
    }
  }
} finally {
  await browser.close();
}
