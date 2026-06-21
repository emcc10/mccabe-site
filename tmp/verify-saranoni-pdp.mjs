import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URL =
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm";
const OUT = path.join(process.cwd(), "tmp", "saranoni-pdp-verify");

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#v65-product-parent, #product_photo", { timeout: 60000 });
  await page.waitForTimeout(8000);

  const meta = await page.evaluate(() => {
    const unified = document.querySelector("td.mc-unified-pdp-info");
    const options = document.querySelector("td.mc-pdp-options-td");
    const parentOf = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const td = el.closest("td");
      return td ? { id: td.id || "", cls: td.className || "" } : null;
    };
    const info =
      document.querySelector("td.mc-unified-pdp-info, td.mc-pdp-options-td") ||
      document.querySelector("#v65-product-parent td:last-child");
    const children = info
      ? Array.from(info.children).map((el) => ({
          tag: el.tagName,
          id: el.id || "",
          cls: (el.className || "").slice(0, 60),
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          display: getComputedStyle(el).display,
          order: getComputedStyle(el).order,
          visible: el.offsetParent !== null || getComputedStyle(el).display !== "none",
        }))
      : [];
    return {
      unifiedCls: unified ? unified.className : null,
      optionsCls: options ? options.className : null,
      sameCell: unified && options ? unified === options : null,
      brandParent: parentOf("mc-pdp-brand-logo"),
      optionParent: parentOf("mc-pdp-option-block"),
      descParent: parentOf("mc-pdp-description-below-features"),
      messagingParent: parentOf("messaging-element"),
      ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || "",
      body: Array.from(document.body.classList).filter((c) => c.includes("mc-") || c.includes("saranoni")),
      jsSrc: Array.from(document.querySelectorAll('script[src*="mc-pdp-auth-cta-fix"]'))
        .map((s) => s.src)
        .join(" | "),
      infoDisplay: info ? getComputedStyle(info).display : null,
      infoFlexDir: info ? getComputedStyle(info).flexDirection : null,
      children,
      hasSizeThumbs: !!document.getElementById("mc-saranoni-size-thumbs"),
      sizeThumbParent: document.getElementById("mc-saranoni-size-thumbs")?.parentElement?.id || "",
      price: document.querySelector("#mc-pdp-price-stack-host .mc-pdp-stack-retail-amt, #mc-pdp-price-stack-host .product_list_price")?.textContent?.trim() || "",
      heroLoading: !!Array.from(document.querySelectorAll("#product_photo, #product_photo_td, #v65-product-parent td"))
        .some((scope) => /loading/i.test(scope.textContent || "")),
      heroSrc: document.getElementById("product_photo")?.src || "",
    };
  });

  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
  await page.screenshot({ path: path.join(OUT, "desktop.png"), fullPage: false });

  // Click XL if thumbs exist
  const xl = page.locator('.mc-saranoni-size-thumb[title="XL"], .mc-saranoni-size-thumb[aria-label="XL"]');
  if (await xl.count()) {
    await xl.first().click();
    await page.waitForTimeout(2000);
    const after = await page.evaluate(() => ({
      price: document.querySelector("#mc-pdp-price-stack-host .mc-pdp-stack-retail-amt, #mc-pdp-price-stack-host .product_list_price, #mc-pdp-price-stack-host [itemprop='price']")?.textContent?.trim() || "",
      heroSrc: document.getElementById("product_photo")?.src || "",
      heroLoading: !!Array.from(document.querySelectorAll("#product_photo_td, #v65-product-parent td"))
        .some((scope) => /loading/i.test(scope.textContent || "")),
      selectedSize: document.querySelector("select[name*='___58']")?.selectedOptions?.[0]?.text || "",
    }));
    fs.writeFileSync(path.join(OUT, "after-xl.json"), JSON.stringify(after, null, 2));
    await page.screenshot({ path: path.join(OUT, "desktop-xl.png"), fullPage: false });
  }

  console.log(JSON.stringify(meta, null, 2));
} finally {
  await browser.close();
}
