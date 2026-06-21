import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tmp", "saranoni-pdp-verify");
const LOCAL_JS = path.join(ROOT, "vspfiles", "js", "mc-pdp-auth-cta-fix.js");
const LOCAL_CSS = path.join(ROOT, "vspfiles", "css", "custom-safe.css");

const PAGES = [
  {
    name: "play-mat",
    url: "https://www.mccabestheaterandliving.com/product-p/sar-mnky-play-mat.htm",
    shot: "play-mat-fixed.png",
  },
  {
    name: "hp-icons",
    url: "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm",
    shot: "hp-icons-fixed.png",
  },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
let failed = false;

for (const p of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route("**/mc-pdp-auth-cta-fix.js**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: fs.readFileSync(LOCAL_JS, "utf8"),
    });
  });
  await page.route("**/custom-safe.css**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css; charset=utf-8",
      body: fs.readFileSync(LOCAL_CSS, "utf8"),
    });
  });

  await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#v65-product-parent, #product_photo", { timeout: 60000 });
  await page.waitForTimeout(15000);

  const audit = await page.evaluate(() => {
    const col = document.querySelector("td.mc-pdp-options-td");
    const media = document.querySelector("td.mc-pdp-media-td");
    const row = document.querySelector("tr.mc-pdp-main-row");
    const photo = document.getElementById("product_photo");
    const picker = document.getElementById("mc-saranoni-color-picker");
    const feat = document.getElementById("mc-pdp-features");
    const ids = col
      ? Array.from(col.children)
          .filter((el) => el.id || el.classList?.contains("mc-saranoni-color-picker"))
          .map((el) => el.id || "mc-saranoni-color-picker")
      : [];
    const expected = [
      "mc-pdp-brand-logo",
      "mc-pdp-title-right",
      "mc-pdp-price-stack-host",
      "messaging-element",
      "mc-pdp-option-block",
      "mc-saranoni-color-picker",
      "mc-pdp-features",
      "mc-pdp-description-below-features",
      "mc-pdp-purchase-stack",
    ];
    let orderOk = true;
    let last = -1;
    expected.forEach((id) => {
      const i = ids.indexOf(id);
      if (i === -1) return;
      if (i < last) orderOk = false;
      last = i;
    });
    const colRect = col ? col.getBoundingClientRect() : null;
    const mediaRect = media ? media.getBoundingClientRect() : null;
    const rowRect = row ? row.getBoundingClientRect() : null;
    const photoRect = photo ? photo.getBoundingClientRect() : null;
    return {
      ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || "",
      ids,
      orderOk,
      colWidth: colRect ? Math.round(colRect.width) : 0,
      mediaWidth: mediaRect ? Math.round(mediaRect.width) : 0,
      rowWidth: rowRect ? Math.round(rowRect.width) : 0,
      photoWidth: photoRect ? Math.round(photoRect.width) : 0,
      pickerBeforeFeatures:
        picker && feat
          ? !!(picker.compareDocumentPosition(feat) & Node.DOCUMENT_POSITION_FOLLOWING)
          : null,
      colDisplay: col ? getComputedStyle(col).display : "",
    };
  });

  fs.writeFileSync(path.join(OUT, `${p.name}-audit.json`), JSON.stringify(audit, null, 2));
  await page.screenshot({ path: path.join(OUT, p.shot), fullPage: false });

  const pass =
    audit.ver === "20260621sarlayout7" &&
    audit.orderOk &&
    audit.colWidth >= 300 &&
    audit.mediaWidth >= 400 &&
    audit.photoWidth >= 350 &&
    audit.rowWidth >= 900 &&
    (audit.pickerBeforeFeatures === null || audit.pickerBeforeFeatures === true);

  console.log(`\n${p.name}:`, JSON.stringify(audit, null, 2));
  if (!pass) {
    console.error(`FAIL: ${p.name}`);
    failed = true;
  } else {
    console.log(`PASS: ${p.name}`);
  }
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
