const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(5000);
  const html = await page.evaluate(() => {
    const p = document.getElementById("v65-product-parent");
    return p ? p.innerHTML : "NO PARENT";
  });
  fs.writeFileSync("tmp/bb_v65_parent_live.html", html);
  console.log("wrote", html.length, "chars");
  console.log("has options_table", html.includes("options_table"));
  console.log("has SELECT___", /SELECT___/i.test(html));
  console.log("has btnaddtocart", html.includes("btnaddtocart"));
  await browser.close();
})();
