"""Verify bean-bag PDP right-column DOM order (pdp38a)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "vspfiles" / "js" / "mc-pdp-auth-cta-fix.js"
URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

AUDIT_JS = """() => {
  const col = document.querySelector('td.mc-pdp-options-td');
  const ids = col
    ? [...col.children]
        .filter((n) => {
          const s = getComputedStyle(n);
          return s.display !== "none" && s.visibility !== "hidden" && s.height !== "0px";
        })
        .map((n) => n.id)
        .filter(Boolean)
    : [];
  const expected = [
    'mc-pdp-brand-logo',
    'mc-pdp-title-right',
    'mc-pdp-price-stack-host',
    'messaging-element',
  ];
  function idx(id) { return ids.indexOf(id); }
  const sizeIdx = ids.indexOf('mc-bb-size-section') >= 0 ? ids.indexOf('mc-bb-size-section') : ids.indexOf('mc-pdp-option-block');
  const coverIdx = ids.indexOf('beanbag-swatch-wrapper');
  const featIdx = ids.indexOf('mc-pdp-features');
  const descIdx = ids.indexOf('mc-pdp-description-below-features');
  const cartIdx = ids.indexOf('mc-pdp-purchase-stack');
  const orderOk =
    idx('mc-pdp-brand-logo') === 0 &&
    idx('mc-pdp-title-right') > idx('mc-pdp-brand-logo') &&
    idx('mc-pdp-price-stack-host') > idx('mc-pdp-title-right') &&
    idx('messaging-element') > idx('mc-pdp-price-stack-host') &&
    (sizeIdx < 0 || (sizeIdx > idx('messaging-element') && sizeIdx < featIdx)) &&
    coverIdx > idx('messaging-element') &&
    coverIdx < featIdx &&
    featIdx < descIdx &&
    descIdx < cartIdx;
  const coverWrap = document.getElementById('beanbag-swatch-wrapper');
  const coverComplete = !!(coverWrap && coverWrap.querySelector('#beanbag-selected-cover, .beanbag-selected-cover') && coverWrap.querySelector('.beanbag-swatches, .beanbag-swatch'));
  const before = (document.getElementById('product_photo')||{}).src || '';
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || '',
    ids,
    orderOk,
    coverComplete,
    logoTop: document.getElementById('mc-pdp-brand-logo')?.getBoundingClientRect().top,
    titleTop: document.getElementById('mc-pdp-title-right')?.getBoundingClientRect().top,
    priceTop: document.getElementById('mc-pdp-price-stack-host')?.getBoundingClientRect().top,
    klarnaTop: document.getElementById('messaging-element')?.getBoundingClientRect().top,
    coverTop: coverWrap?.getBoundingClientRect().top,
    featTop: document.getElementById('mc-pdp-features')?.getBoundingClientRect().top,
    beforeSrc: before,
  };
}"""


def main(use_local_js=True):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 1100})
        if use_local_js:
            page.route(
                "**/*mc-pdp-auth-cta-fix.js*",
                lambda r: r.fulfill(path=str(JS), content_type="application/javascript"),
            )
        page.goto(URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(14000)
        data = page.evaluate(AUDIT_JS)
        pink = page.query_selector('.beanbag-swatch[data-option*="Pink"]')
        if pink:
            pink.click()
            page.wait_for_timeout(800)
        after = page.evaluate("() => (document.getElementById('product_photo')||{}).src || ''")
        data["swatchChanged"] = data["beforeSrc"] != after and "pink" in after.lower()
        page.screenshot(path=str(ROOT / "tmp" / "verify-bb-column-order.png"))
        browser.close()
    print(json.dumps(data, indent=2))
    ok = (
        data.get("ver") == "20260616pdp38a"
        and data.get("orderOk")
        and data.get("coverComplete")
        and data.get("logoTop", 9999) < data.get("titleTop", 0)
        and data.get("swatchChanged")
    )
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main(use_local_js=True))
