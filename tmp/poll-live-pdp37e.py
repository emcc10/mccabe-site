import time
import json
from playwright.sync_api import sync_playwright

URLS = {
    "blanket": "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm",
    "beanbag": "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
}

AUDIT_JS = """() => {
  const col = document.querySelector('td.mc-pdp-options-td');
  const title = document.getElementById('mc-pdp-title-right');
  const logo = document.getElementById('mc-pdp-brand-logo');
  const price = document.getElementById('mc-pdp-price-stack-host');
  const img = document.getElementById('product_photo');
  const ir = img ? img.getBoundingClientRect() : null;
  const kids = col ? [...col.children].map(n => n.id || n.tagName) : [];
  function idx(id) { return kids.indexOf(id); }
  return {
    scriptVer: window.__MC_PDP_AUTH_CTA_FIX_VER__ || '',
    titleInCol: !!(col && title && col.contains(title)),
    logoInCol: !!(col && logo && col.contains(logo)),
    priceInCol: !!(col && price && col.contains(price)),
    orderOk: idx('mc-pdp-title-right') >= 0
      && idx('mc-pdp-brand-logo') > idx('mc-pdp-title-right')
      && idx('mc-pdp-price-stack-host') > idx('mc-pdp-brand-logo'),
    imgW: ir ? Math.round(ir.width) : 0,
    colKids: kids,
  };
}"""


def main():
    for attempt in range(15):
        out = {}
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for name, url in URLS.items():
                page = browser.new_page(viewport={"width": 1400, "height": 1100})
                page.goto(url, wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(12000)
                out[name] = page.evaluate(AUDIT_JS)
                if name == "blanket":
                    page.screenshot(path="tmp/live-blanket-pdp37e.png")
                page.close()
            browser.close()
        print(f"attempt {attempt + 1}:", json.dumps(out))
        if all(
            out[n]["scriptVer"] == "20260616pdp37e"
            and out[n]["titleInCol"]
            and out[n]["logoInCol"]
            and out[n]["priceInCol"]
            and out[n]["orderOk"]
            and out[n]["imgW"] >= 500
            for n in out
        ):
            print("LIVE PASS")
            return 0
        time.sleep(30)
    print("LIVE NOT READY")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
