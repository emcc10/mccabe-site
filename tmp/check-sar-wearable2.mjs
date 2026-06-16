import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));

await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      top: r.top,
      left: r.left,
      w: r.width,
      h: r.height,
      display: s.display,
      overflow: s.overflow,
      position: s.position,
    };
  };
  const rows = Array.from(document.querySelectorAll("#v65-product-parent > tbody > tr, #v65-product-parent > tr")).map(
    (tr, i) => ({
      i,
      classes: tr.className,
      display: getComputedStyle(tr).display,
      h: tr.offsetHeight,
      html: tr.innerHTML.slice(0, 120).replace(/\s+/g, " "),
    })
  );
  return {
    rows,
    photo: rect("#product_photo"),
    v65: rect("#v65-product-parent"),
    content: rect("#content_area"),
    mediaTd: rect("td.mc-pdp-media-td"),
    optionsTd: rect("td.mc-pdp-options-td"),
    mainRow: rect("tr.mc-pdp-main-row"),
    swatchWrap: rect("#mc-configured-color-swatch-wrapper"),
    swatchCount: document.querySelectorAll(".mc-configured-color-swatch").length,
  };
});

console.log(JSON.stringify({ info, errors }, null, 2));
await page.screenshot({ path: "sar-wearable-screenshot.png", fullPage: false });
await browser.close();
