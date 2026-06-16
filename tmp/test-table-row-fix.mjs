import { chromium } from "playwright";

const cssFix = `
@media (min-width: 992px) {
  body.mc-product-page #v65-product-parent,
  body.productdetails #v65-product-parent {
    display: table !important;
    width: 100% !important;
  }
  body.mc-product-page #v65-product-parent > tbody,
  body.productdetails #v65-product-parent > tbody {
    display: table-row-group !important;
  }
  body.mc-product-page #v65-product-parent > tbody > tr:nth-of-type(2),
  body.productdetails #v65-product-parent > tbody > tr:nth-of-type(2),
  body.mc-product-page #v65-product-parent > tbody > tr.mc-pdp-main-row,
  body.productdetails #v65-product-parent > tbody > tr.mc-pdp-main-row,
  body.mc-saranoni-pdp #content_area tr.mc-pdp-main-row,
  body.mc-bean-bag-pdp #content_area tr.mc-pdp-main-row {
    display: table-row !important;
    height: auto !important;
  }
  body.mc-product-page #v65-product-parent > tbody > tr:nth-of-type(2) > td,
  body.productdetails #v65-product-parent > tbody > tr:nth-of-type(2) > td,
  body.mc-product-page tr.mc-pdp-main-row > td,
  body.productdetails tr.mc-pdp-main-row > td {
    display: table-cell !important;
    vertical-align: top !important;
    height: auto !important;
  }
}
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(3000);
await page.addStyleTag({ content: cssFix });
await page.waitForTimeout(500);

const info = await page.evaluate(() => ({
  v65h: document.getElementById("v65-product-parent")?.offsetHeight,
  trh: document.querySelector("#v65-product-parent > tbody > tr:nth-of-type(2)")?.offsetHeight,
  trDisplay: getComputedStyle(document.querySelector("#v65-product-parent > tbody > tr:nth-of-type(2)")).display,
  photo: document.getElementById("product_photo")?.offsetHeight,
}));
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "sar-wearable-table-row-fix.png", fullPage: false });
await browser.close();
