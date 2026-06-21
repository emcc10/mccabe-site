import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_JS = path.join(ROOT, "vspfiles", "js", "mc-pdp-auth-cta-fix.js");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.route("**/mc-pdp-auth-cta-fix.js**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: fs.readFileSync(LOCAL_JS, "utf8"),
  });
});
await page.goto(
  "https://www.mccabestheaterandliving.com/product-p/sar-hp-hp-icons-mnky-lush.htm",
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForTimeout(9000);
const d = await page.evaluate(() => {
  const opt = document.getElementById("mc-pdp-option-block");
  const msg = document.getElementById("messaging-element");
  const col = document.querySelector("td.mc-pdp-options-td");
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    optionsTable: !!document.getElementById("options_table"),
    select58: !!document.querySelector("select[name*='___58']"),
    opt: opt
      ? {
          parent: opt.parentElement?.className,
          html: opt.outerHTML.slice(0, 200),
          display: getComputedStyle(opt).display,
          rect: opt.getBoundingClientRect(),
        }
      : null,
    msg: msg
      ? {
          parentId: msg.parentElement?.id,
          parentCls: msg.parentElement?.className,
          inCol: !!msg.closest("td.mc-pdp-options-td"),
        }
      : null,
    colChildren: col
      ? Array.from(col.children).map((c) => ({ id: c.id, tag: c.tagName, d: getComputedStyle(c).display }))
      : [],
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
