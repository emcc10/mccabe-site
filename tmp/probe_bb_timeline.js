const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs = [];
  page.on("console", (msg) => logs.push(msg.text()));
  await page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  for (const wait of [3000, 8000, 15000, 25000]) {
    await page.waitForTimeout(wait === 3000 ? 3000 : wait - (wait === 8000 ? 3000 : wait === 15000 ? 8000 : 15000));
    const snap = await page.evaluate((ms) => {
      const ot = document.getElementById("options_table");
      const selects = document.querySelectorAll("select").length;
      const parent = document.getElementById("v65-product-parent");
      return {
        ms,
        ot: !!ot,
        selects,
        parentHtml: parent ? parent.innerHTML.includes("options_table") : false,
        parentLen: parent ? parent.innerHTML.length : 0,
      };
    }, wait);
    console.log(snap);
  }
  console.log("console tail", logs.slice(-15));
  await browser.close();
})();
