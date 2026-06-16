import time
import json
from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
AUDIT_JS = """() => {
  const col = document.querySelector('td.mc-pdp-options-td');
  const ids = col ? [...col.children].filter(n => {
    const s = getComputedStyle(n);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.height !== '0px';
  }).map(n => n.id).filter(Boolean) : [];
  function idx(id) { return ids.indexOf(id); }
  const featIdx = ids.indexOf('mc-pdp-features');
  const coverIdx = ids.indexOf('beanbag-swatch-wrapper');
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || '',
    ids,
    orderOk: idx('mc-pdp-brand-logo') === 0 &&
      idx('mc-pdp-title-right') > 0 &&
      idx('mc-pdp-price-stack-host') > idx('mc-pdp-title-right') &&
      idx('messaging-element') > idx('mc-pdp-price-stack-host') &&
      coverIdx > idx('messaging-element') && coverIdx < featIdx &&
      idx('mc-pdp-description-below-features') > featIdx &&
      idx('mc-pdp-purchase-stack') > idx('mc-pdp-description-below-features'),
    logoTop: document.getElementById('mc-pdp-brand-logo')?.getBoundingClientRect().top,
    titleTop: document.getElementById('mc-pdp-title-right')?.getBoundingClientRect().top,
  };
}"""

for attempt in range(15):
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1400, "height": 1100})
        pg.goto(URL, wait_until="domcontentloaded", timeout=90000)
        pg.wait_for_timeout(14000)
        data = pg.evaluate(AUDIT_JS)
        pink = pg.query_selector('.beanbag-swatch[data-option*="Pink"]')
        before = pg.evaluate("() => (document.getElementById('product_photo')||{}).src || ''")
        if pink:
            pink.click()
            pg.wait_for_timeout(800)
        after = pg.evaluate("() => (document.getElementById('product_photo')||{}).src || ''")
        data["swatchChanged"] = before != after and "pink" in after.lower()
        if data.get("orderOk"):
            pg.screenshot(path="tmp/live-bb-order-pdp38a.png")
        b.close()
    print(f"attempt {attempt+1}:", json.dumps(data))
    if data.get("ver") == "20260616pdp38a" and data.get("orderOk") and data.get("swatchChanged"):
        print("LIVE PASS")
        break
    time.sleep(30)
else:
    print("LIVE NOT READY")
    raise SystemExit(1)
