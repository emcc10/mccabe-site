const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(9000);

  const data = await page.evaluate(() => {
    const sizeSection = document.getElementById("mc-bb-size-section");
    const sizeLabel = document.getElementById("mc-bb-size-label");
    const selects = [...document.querySelectorAll("#options_table select, #v65-product-parent select")].map((s) => ({
      name: s.name,
      inForm: !!s.closest("form"),
      parentId: (s.parentElement && s.parentElement.id) || "",
      visible: !!(s.offsetWidth || s.offsetHeight),
      display: getComputedStyle(s).display,
      value: s.value,
      opts: [...s.options].slice(0, 8).map((o) => ({ v: o.value, t: o.text.trim() })),
    }));
    const coverSel = document.querySelector('#options_table select[name*="___4"], select[name*="___4"]');
    const activeSwatch = document.querySelector(".beanbag-swatch.active");
    return {
      ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
      bodyClass: document.body.className,
      sizeSection: sizeSection
        ? {
            display: getComputedStyle(sizeSection).display,
            visible: !!(sizeSection.offsetWidth || sizeSection.offsetHeight),
            html: sizeSection.innerHTML.slice(0, 400),
          }
        : null,
      sizeLabel: sizeLabel ? sizeLabel.textContent : null,
      selects,
      coverSelValue: coverSel ? coverSel.value : null,
      coverSelName: coverSel ? coverSel.name : null,
      activeSwatch: activeSwatch ? activeSwatch.getAttribute("data-option") : null,
      swatchCount: document.querySelectorAll(".beanbag-swatch").length,
    };
  });

  // click gray swatch and check cover sync
  const gray = page.locator('.beanbag-swatch[data-option*="Gray"]');
  if (await gray.count()) {
    await gray.first().click();
    await page.waitForTimeout(500);
    data.afterGrayClick = await page.evaluate(() => {
      const coverSel = document.querySelector('#options_table select[name*="___4"], select[name*="___4"]');
      return {
        coverValue: coverSel ? coverSel.value : null,
        coverText: coverSel && coverSel.selectedIndex >= 0 ? coverSel.options[coverSel.selectedIndex].text : null,
        active: document.querySelector(".beanbag-swatch.active")?.getAttribute("data-option"),
        label: document.getElementById("beanbag-selected-cover-name")?.textContent,
      };
    });
  }

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
