const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(12000);

  const data = await page.evaluate(() => {
    const ot = document.getElementById("options_table");
    const allSelects = [...document.querySelectorAll("select")].map((s) => ({
      name: s.name,
      id: s.id,
      inOt: !!(ot && ot.contains(s)),
      inForm: !!s.closest("form"),
      opts: s.options.length,
      sample: s.options[0] ? s.options[0].text : "",
    }));
    return {
      optionsTable: ot
        ? {
            className: ot.className,
            dataset: { ...ot.dataset },
            display: getComputedStyle(ot).display,
            position: getComputedStyle(ot).position,
            left: getComputedStyle(ot).left,
            htmlLen: ot.innerHTML.length,
            snippet: ot.innerHTML.slice(0, 800),
          }
        : null,
      allSelects,
      productCode: document.querySelector('input[name="ProductCode"]')?.value,
      priceWithOptions: document.getElementById("priceWithOptions")?.innerHTML?.slice(0, 200),
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
