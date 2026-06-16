import { chromium } from "playwright";

const urls = [
  "https://www.mccabestheaterandliving.com/product-p/sar-minky-lush-extra-large-blankets.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-jl-jl-msln-lush.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

for (const url of urls) {
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    const data = await page.evaluate(() => {
      const btn = document.querySelector(
        '#mc-pdp-purchase-stack input[name="btnaddtocart"], #mc-pdp-purchase-stack .vCSS_input_addtocart, input[name="btnaddtocart"]'
      );
      const wrap = document.querySelector("#mc-pdp-purchase-stack .mc-atc-button-wrap");
      const ret = document.querySelector(".mc-return-category");
      const mainRow = document.querySelector("tr.mc-pdp-main-row");
      const cs = btn ? getComputedStyle(btn) : null;
      const wcs = wrap ? getComputedStyle(wrap) : null;
      const parent = document.querySelector("#v65-product-parent");
      const media = document.querySelector("td.mc-pdp-media-td");
      return {
        title: document.title,
        ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
        status: document.body?.className,
        hasMainRow: !!mainRow,
        hasReturn: !!ret,
        returnText: ret?.textContent?.trim(),
        returnDisplay: ret ? getComputedStyle(ret).display : null,
        returnParent: ret?.parentElement?.className || ret?.parentElement?.tagName,
        btnTag: btn?.tagName,
        btnType: btn?.type,
        btnClass: btn?.className,
        btnBg: cs?.backgroundColor,
        btnColor: cs?.color,
        btnBorder: cs?.border,
        wrapBg: wcs?.backgroundColor,
        hasWrap: !!wrap,
        parentDisplay: parent ? getComputedStyle(parent).display : null,
        mainRowDisplay: mainRow ? getComputedStyle(mainRow).display : null,
        mediaWidth: media ? getComputedStyle(media).width : null,
        photoWidth: document.querySelector("#product_photo")
          ? getComputedStyle(document.querySelector("#product_photo")).width
          : null,
      };
    });
    console.log("\n===", url, res?.status(), "===");
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("\n===", url, "ERROR ===", e.message);
  }
}

await browser.close();
