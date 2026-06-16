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
  const b = document.body;
  const vis = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      display: s.display,
      visibility: s.visibility,
      opacity: s.opacity,
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
  };
  return {
    classes: b.className,
    heroReady: b.classList.contains("mc-pdp-hero-ready"),
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    purchaseStack: !!document.getElementById("mc-pdp-purchase-stack"),
    titleRight: !!document.getElementById("mc-pdp-title-right"),
    photo: vis(document.getElementById("product_photo")),
    options: vis(document.getElementById("options_table")),
    stack: vis(document.getElementById("mc-pdp-purchase-stack")),
    titleRightVis: vis(document.getElementById("mc-pdp-title-right")),
    priceHost: vis(document.getElementById("mc-pdp-price-stack-host")),
    v65: vis(document.getElementById("v65-product-parent")),
    h1: document.querySelector("h1")?.textContent?.trim(),
  };
});

console.log(JSON.stringify({ info, errors }, null, 2));
await browser.close();
