import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const cases = [
  ["https://www.mccabestheaterandliving.com/product-p/sar-grand-fx-fur-12x20.htm", "1036", "Fawn"],
  ["https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm", "1048", "Charcoal"],
  ["https://www.mccabestheaterandliving.com/product-p/sar-lush.htm", "1048", "Charcoal"],
];

for (const [url, oid, label] of cases) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  const before = await page.evaluate(() => ({
    hero: document.querySelector("#product_photo")?.src || "",
    swatches: [...document.querySelectorAll(".mc-configured-color-swatch")].map((b) => ({
      id: b.getAttribute("data-option-id"),
      main: b.getAttribute("data-main-image"),
      img: b.querySelector("img")?.src || "",
    })),
  }));
  const sw = `.mc-configured-color-swatch[data-option-id="${oid}"]`;
  if (await page.locator(sw).count()) {
    await page.click(sw);
  } else if (hasOpt) {
    await page.evaluate(({ oid }) => {
      const sel = document.querySelector('select[name*="___23"]');
      if (!sel) return;
      for (const opt of sel.options) {
        if (String(opt.value).includes(oid)) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          break;
        }
      }
    }, { oid });
  }
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => document.querySelector("#product_photo")?.src || "");
  const swatchHit = before.swatches.find((s) => s.id === oid);
  console.log("\n" + url.split("/").pop());
  console.log("  color:", label, oid);
  console.log("  hero before:", before.hero.split("/").pop());
  console.log("  swatch data-main:", swatchHit?.main?.split("/").pop() || "(none)");
  console.log("  swatch img:", swatchHit?.img?.split("/").pop() || "(none)");
  console.log("  hero after select:", after.split("/").pop());
  const pc = url.includes("12x20")
    ? "SAR-GRAND-FX-FUR-12X20"
    : url.includes("dbl-rch")
      ? "SAR-DBL-RCH-FX-FUR"
      : "SAR-LUSH";
  console.log("  expected:", `${pc}-${oid}-T.jpg`);
  console.log("  matches product?", after.includes(`${pc}-${oid}`));
}
await browser.close();
