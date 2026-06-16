import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const tr = document.querySelector("#v65-product-parent > tbody > tr:nth-of-type(2)");
  if (!tr) return { err: "no tr" };
  return {
    classList: Array.from(tr.classList),
    className: tr.className,
    display: getComputedStyle(tr).display,
    height: tr.offsetHeight,
    tdClasses: Array.from(tr.children).map((td) => ({
      tag: td.tagName,
      classes: Array.from(td.classList),
      display: getComputedStyle(td).display,
      h: td.offsetHeight,
    })),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
