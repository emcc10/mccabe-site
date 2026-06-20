import { chromium } from "playwright";
import https from "https";

function head(url) {
  return new Promise((resolve) => {
    https
      .request(url, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        resolve(res.statusCode);
      })
      .on("error", () => resolve(0))
      .end();
  });
}

const CDN = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/";
const files = [
  "SAR-BMB-SOCKS-2T.jpg",
  "SAR-BMB-SOCKS-1048-T.jpg",
  "SAR-BMB-SOCKS-1048-S.jpg",
  "SAR-BMB-SOCKS-1012-T.jpg",
  "SAR-LUSH-1048-T.jpg",
  "SAR-BMB-HATS-1048-T.jpg",
];
for (const f of files) {
  console.log(f, (await head(CDN + f)) === 200 ? "EXISTS" : "missing");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://www.mccabestheaterandliving.com/product-p/sar-bmb-socks.htm", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const hero = document.querySelector("#product_photo")?.src || "";
  const swatches = [...document.querySelectorAll(".mc-configured-color-swatch")].map((b) => ({
    id: b.getAttribute("data-option-id"),
    label: b.getAttribute("data-label"),
    main: b.getAttribute("data-main-image"),
    img: b.querySelector("img")?.src || "",
  }));
  const alts = [...document.querySelectorAll("#altviews img, .altviews img")].map((i) => i.src);
  const sel = document.querySelector('select[name*="SAR-BMB-SOCKS"]');
  const opts = sel
    ? [...sel.options].map((o) => ({ v: o.value, t: o.text, selected: o.selected }))
    : [];
  return { hero, swatches, alts, opts };
});
console.log("\nBefore select:", info);

await page.evaluate(() => {
  const btn = document.querySelector('.mc-configured-color-swatch[data-option-id="1048"]');
  if (btn) btn.click();
  else {
    const sel = document.querySelector('select[name*="___23"]');
    if (sel) {
      for (const o of sel.options) {
        if (String(o.value).includes("1048")) {
          sel.value = o.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          break;
        }
      }
    }
  }
});
await page.waitForTimeout(2500);

const after = await page.evaluate(() => ({
  hero: document.querySelector("#product_photo")?.src || "",
  alts: [...document.querySelectorAll("#altviews img, .altviews img")].map((i) => i.src),
}));
console.log("\nAfter Charcoal:", after);
await browser.close();
