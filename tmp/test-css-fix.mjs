import { chromium } from "playwright";
import fs from "fs";

const cssFix = fs.readFileSync("../vspfiles/css/custom-safe.css", "utf8");
const cssBlock = cssFix.slice(cssFix.indexOf("PDP row-2 flex collapse fix"));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(3000);
await page.addStyleTag({ content: cssBlock });

const before = await page.evaluate(() => ({
  v65h: document.getElementById("v65-product-parent")?.offsetHeight,
  trh: document.querySelector("#v65-product-parent > tbody > tr:nth-of-type(2)")?.offsetHeight,
}));

await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  v65h: document.getElementById("v65-product-parent")?.offsetHeight,
  trh: document.querySelector("#v65-product-parent > tbody > tr:nth-of-type(2)")?.offsetHeight,
  photo: document.getElementById("product_photo")?.offsetHeight,
  classes: document.querySelector("#v65-product-parent > tbody > tr:nth-of-type(2)")?.className,
}));

console.log(JSON.stringify({ before, after }, null, 2));
await page.screenshot({ path: "sar-wearable-after-fix.png", fullPage: false });
await browser.close();
