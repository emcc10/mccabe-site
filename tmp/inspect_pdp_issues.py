from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"

JS = """
() => {
  const styleOf = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80),
      fs: cs.fontSize,
      pl: cs.paddingLeft,
      ml: cs.marginLeft,
      left: Math.round(r.left),
      tt: cs.textTransform,
      ls: cs.letterSpacing,
      color: cs.color,
      display: cs.display,
      vis: cs.visibility,
    };
  };
  const qtyLabels = [...document.querySelectorAll("label, span, div, td, p, .mc-pdp-qty-row__label")]
    .filter((el) => /^\\s*(quantity|qty)\\s*:?\\s*$/i.test((el.textContent || "").replace(/\\s+/g, " ").trim()))
    .map((el) => ({
      tag: el.tagName,
      id: el.id,
      cls: (el.className || "").slice(0, 60),
      parent: el.parentElement ? el.parentElement.id || el.parentElement.className.slice(0, 40) : "",
      ...styleOf(el),
    }));
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    heroPending: document.body.classList.contains("mc-pdp-hero-pending"),
    heroReady: document.body.classList.contains("mc-pdp-hero-ready"),
    title: styleOf(document.getElementById("mc-pdp-title-right")),
    titleH1: styleOf(document.querySelector("#mc-pdp-title-right h1, #mc-pdp-title-right [itemprop=name]")),
    featuresHeading: styleOf(document.querySelector("#mc-pdp-features .mc-pdp-features__heading")),
    featuresList: styleOf(document.querySelector("#mc-pdp-features .mc-pdp-features__list")),
    price: styleOf(document.querySelector("#mc-pdp-price-stack-host .product_list_price, #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt")),
    qtyRow: styleOf(document.getElementById("mc-pdp-qty-row")),
    atc: styleOf(document.querySelector(".mc-atc-button-wrap")),
    qtyLabels,
    offersHtml: (document.querySelector('[itemprop="offers"]') || {}).innerHTML?.slice(0, 1200),
  };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1200})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(10000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
