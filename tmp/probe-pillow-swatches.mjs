import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-grand-fx-fur-12x20.htm", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(6000);

const before = await page.evaluate(() => ({
  hero: document.querySelector("#product_photo")?.src,
  swatches: Array.from(document.querySelectorAll(".mc-configured-color-swatch")).map((btn) => ({
    id: btn.getAttribute("data-option-id"),
    main: btn.getAttribute("data-main-image"),
    img: btn.querySelector("img")?.src,
  })),
}));

await page.evaluate(() => {
  const btn = document.querySelector('.mc-configured-color-swatch[data-option-id="1036"]');
  if (btn) btn.click();
});
await page.waitForTimeout(2500);

const after = await page.evaluate(() => ({
  hero: document.querySelector("#product_photo")?.src,
  active: document.querySelector(".mc-configured-color-swatch.active")?.getAttribute("data-option-id"),
}));

console.log(JSON.stringify({ before, after }, null, 2));
await browser.close();
