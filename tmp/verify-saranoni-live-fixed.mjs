import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL =
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm";
const OUT = path.join(ROOT, "tmp", "saranoni-pdp-verify");
const LOCAL_JS = path.join(ROOT, "vspfiles", "js", "mc-pdp-auth-cta-fix.js");
const LOCAL_CSS = path.join(ROOT, "vspfiles", "css", "custom-safe.css");
const EXPECTED = [
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
await page.route("**/custom-safe.css**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "text/css; charset=utf-8",
    body: fs.readFileSync(LOCAL_CSS, "utf8"),
  });
});

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector("#v65-product-parent, #product_photo", { timeout: 60000 });
await page.waitForTimeout(15000);

const audit = await page.evaluate((expected) => {
  const col = document.querySelector("td.mc-pdp-options-td");
  const colSt = col ? getComputedStyle(col) : null;
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
  const msg = document.getElementById("messaging-element");
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || "",
    colWidth: col ? Math.round(col.getBoundingClientRect().width) : 0,
    colDisplay: colSt ? colSt.display : "",
    colFlexDir: colSt ? colSt.flexDirection : "",
    visibleIds,
    idx,
    orderOk,
    rects,
    messagingInCol: !!(msg && col && col.contains(msg)),
    hasThumbs: !!document.getElementById("mc-saranoni-size-thumbs"),
    thumbInMedia: !!document.querySelector("td.mc-pdp-media-td #mc-saranoni-size-thumbs"),
    hasSizeBlock: !!document.querySelector("#mc-pdp-option-block select[name*='___58']"),
  };
}, EXPECTED);

fs.writeFileSync(path.join(OUT, "fixed-audit.json"), JSON.stringify(audit, null, 2));
await page.screenshot({ path: path.join(OUT, "fixed-layout.png"), fullPage: false });

const pass =
  audit.ver === "20260621sarlayout6" &&
  audit.orderOk &&
  audit.messagingInCol &&
  audit.hasSizeBlock &&
  audit.hasThumbs &&
  audit.thumbInMedia &&
  audit.colWidth >= 280 &&
  audit.rects["mc-pdp-brand-logo"] &&
  audit.rects["mc-pdp-option-block"] &&
  audit.rects["mc-pdp-features"] &&
  audit.rects["mc-pdp-brand-logo"].top < audit.rects["mc-pdp-option-block"].top &&
  audit.rects["mc-pdp-option-block"].top < audit.rects["mc-pdp-features"].top &&
  audit.rects["mc-pdp-features"].top < audit.rects["mc-pdp-purchase-stack"].top;

console.log(JSON.stringify(audit, null, 2));
if (!pass) {
  console.error("FAIL: Saranoni PDP fixed layout audit");
  process.exitCode = 1;
} else {
  console.log("PASS: Saranoni PDP fixed layout audit");
}

await browser.close();
