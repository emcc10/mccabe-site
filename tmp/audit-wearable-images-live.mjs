import { chromium } from "playwright";

const url = "https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

const info = await page.evaluate(() => {
  const code =
    document.querySelector('input[name="ProductCode"],input[name="productcode"]')?.value || "";
  const main =
    document.querySelector("#product_photo, img#product_photo, #main-image")?.getAttribute("src") ||
    "";
  const alt = [...document.querySelectorAll("#altviews img, span#altviews img")].map((i) => ({
    src: i.getAttribute("src"),
    display: getComputedStyle(i).display,
    w: i.offsetWidth,
    h: i.offsetHeight,
  }));
  const altRoot = document.querySelector("#altviews, span#altviews");
  const opts = [];
  document.querySelectorAll("#options_table select").forEach((sel) => {
    const label =
      sel.closest("tr")?.querySelector("td")?.textContent?.replace(/\s+/g, " ").trim() || sel.name;
    [...sel.options].forEach((o) => {
      if (!o.value) return;
      opts.push({ label, id: o.value, text: o.textContent.replace(/\s+/g, " ").trim() });
    });
  });
  const swatchWrap = document.querySelector(
    "#mc-configured-color-swatch-wrapper, .mc-configured-color-swatch-wrapper, #mc-saranoni-color-swatches"
  );
  const swatches = [...document.querySelectorAll(
    "#mc-configured-color-swatch-wrapper img, .mc-configured-color-swatch img, [data-mc-color] img, button.mc-configured-color-swatch, .mc-color-swatch"
  )].map((el) => ({
    tag: el.tagName,
    src: el.getAttribute("src") || "",
    text: (el.getAttribute("aria-label") || el.title || el.textContent || "").trim().slice(0, 80),
    html: el.outerHTML.slice(0, 180),
  }));
  const bodyClass = document.body.className;
  const hiddenAlt =
    altRoot &&
    (getComputedStyle(altRoot).display === "none" ||
      altRoot.classList.contains("mc-altviews-empty") ||
      getComputedStyle(altRoot).visibility === "hidden");
  return {
    code,
    bodyClass,
    main,
    altCount: alt.length,
    alt,
    altRootDisplay: altRoot ? getComputedStyle(altRoot).display : null,
    altRootHtml: altRoot ? altRoot.outerHTML.slice(0, 500) : null,
    hiddenAlt,
    opts,
    swatchWrap: !!swatchWrap,
    swatchWrapDisplay: swatchWrap ? getComputedStyle(swatchWrap).display : null,
    swatches,
  };
});

console.log(JSON.stringify(info, null, 2));
await page.screenshot({
  path: "tmp/saranoni-pdp-verify/wearable-live-check.png",
  fullPage: false,
});
await browser.close();
