import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm",
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForTimeout(4000);
const d = await page.evaluate(() => {
  const m = document.getElementById("messaging-element");
  const opt = document.getElementById("mc-pdp-option-block");
  const tbl = document.getElementById("options_table");
  const sel = document.querySelector("select[name*='___58']");
  const col = document.querySelector("td.mc-pdp-options-td");
  return {
    messaging: m
      ? {
          parent: m.parentElement?.tagName,
          inCol: !!m.closest("td.mc-pdp-options-td"),
        }
      : null,
    optionBlock: opt
      ? {
          parent: opt.parentElement?.tagName,
          hasSelect: !!opt.querySelector("select"),
          display: getComputedStyle(opt).display,
        }
      : null,
    optionsTable: tbl
      ? { parent: tbl.parentElement?.id || tbl.parentElement?.tagName }
      : null,
    select: sel
      ? { name: sel.name, inBlock: !!sel.closest("#mc-pdp-option-block") }
      : null,
    priceBoxes: document.querySelectorAll("td.mc-pdp-options-td > table.colors_pricebox").length,
    optionPricing: document.querySelectorAll("td.mc-pdp-options-td .option_pricing").length,
    colChildTables: col
      ? Array.from(col.children)
          .filter((n) => n.tagName === "TABLE")
          .map((n) => n.className)
      : [],
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
