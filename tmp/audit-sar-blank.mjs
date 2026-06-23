import { chromium } from "playwright";

const URLS = [
  "https://www.mccabestheaterandliving.com/product-p/sar-bmb-snuggler.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm",
];

const browser = await chromium.launch({ headless: true });
for (const url of URLS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#v65-product-parent", { timeout: 60000 });
  await page.waitForTimeout(12000);
  const audit = await page.evaluate(() => {
    const pp = document.getElementById("v65-product-parent");
    const ppCs = pp ? getComputedStyle(pp) : null;
    const photo = document.getElementById("product_photo");
    const photoCs = photo ? getComputedStyle(photo) : null;
    const scripts = Array.from(document.querySelectorAll('script[src*="mc-pdp-auth-cta-fix"]')).map(
      (s) => s.src
    );
    const customNodes = [
      "mc-pdp-brand-logo",
      "mc-pdp-title-right",
      "mc-pdp-price-stack-host",
      "mc-pdp-accordion",
      "mc-pdp-purchase-stack",
      "mc-pdp-main-row",
    ].map((id) => {
      const el = document.getElementById(id);
      if (!el) return { id, exists: false };
      const cs = getComputedStyle(el);
      return {
        id,
        exists: true,
        display: cs.display,
        visibility: cs.visibility,
        height: cs.height,
        rectH: Math.round(el.getBoundingClientRect().height),
      };
    });
    return {
      url: location.href,
      bodyClasses: document.body.className,
      ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || "",
      scripts,
      hasUnblockCss: !!document.getElementById("mc-saranoni-native-unblock-css"),
      v65: pp
        ? {
            innerLen: pp.innerHTML.length,
            display: ppCs.display,
            visibility: ppCs.visibility,
            height: ppCs.height,
            rectH: Math.round(pp.getBoundingClientRect().height),
          }
        : null,
      photo: photo
        ? {
            src: photo.src?.slice(-40),
            display: photoCs.display,
            visibility: photoCs.visibility,
            rectH: Math.round(photo.getBoundingClientRect().height),
          }
        : null,
      customNodes,
      hasMcPdpMainRow: !!document.querySelector("tr.mc-pdp-main-row"),
      optionsTable: (() => {
        const ot = document.getElementById("options_table");
        if (!ot) return null;
        const cs = getComputedStyle(ot);
        return { display: cs.display, visibility: cs.visibility, rectH: Math.round(ot.getBoundingClientRect().height) };
      })(),
    };
  });
  console.log(JSON.stringify(audit, null, 2));
  await page.close();
}
await browser.close();
