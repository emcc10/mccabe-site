import { chromium } from "playwright";

const URL =
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(15000);

const data = await page.evaluate(() => {
  const msg = document.getElementById("messaging-element");
  const col = document.querySelector("td.mc-pdp-options-td");
  const row = document.querySelector("tr.mc-pdp-main-row");
  const media = document.querySelector("td.mc-pdp-media-td");
  function info(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return {
      id: el.id || el.className?.slice?.(0, 40),
      tag: el.tagName,
      parent: el.parentElement?.id || el.parentElement?.className?.slice?.(0, 40),
      top: Math.round(r.top),
      left: Math.round(r.left),
      width: Math.round(r.width),
      display: st.display,
      position: st.position,
      visibility: st.visibility,
    };
  }
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    bodyClasses: document.body.className,
    row: info(row),
    media: info(media),
    col: info(col),
    msg: info(msg),
    msgInCol: !!(msg && col && col.contains(msg)),
    colChildren: col
      ? Array.from(col.children).slice(0, 12).map((c) => info(c))
      : [],
    msgAncestors: msg
      ? (function () {
          const a = [];
          let w = msg;
          while (w && w !== document.body) {
            a.push({ tag: w.tagName, id: w.id, cls: w.className?.slice?.(0, 30) });
            w = w.parentElement;
          }
          return a;
        })()
      : [],
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
