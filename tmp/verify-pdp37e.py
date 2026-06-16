"""Verify soft-goods PDP layout with local JS/CSS overrides before live deploy."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "vspfiles" / "js" / "mc-pdp-auth-cta-fix.js"
CSS = ROOT / "vspfiles" / "css" / "custom-safe.css"

PAGES = [
    ("blanket", "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"),
    ("beanbag", "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"),
]


def audit(page, name):
    return page.evaluate(
        """() => {
      const col = document.querySelector('td.mc-pdp-options-td');
      const title = document.getElementById('mc-pdp-title-right');
      const logo = document.getElementById('mc-pdp-brand-logo');
      const price = document.getElementById('mc-pdp-price-stack-host');
      const msg = document.getElementById('messaging-element');
      const img = document.getElementById('product_photo');
      const ir = img ? img.getBoundingClientRect() : null;
      const kids = col ? [...col.children].map(n => n.id || n.tagName) : [];
      function idx(id) { return kids.indexOf(id); }
      const orderOk = idx('mc-pdp-title-right') >= 0
        && idx('mc-pdp-brand-logo') > idx('mc-pdp-title-right')
        && idx('mc-pdp-price-stack-host') > idx('mc-pdp-brand-logo')
        && (idx('messaging-element') < 0 || idx('messaging-element') > idx('mc-pdp-price-stack-host'));
      return {
        mounted: document.body.dataset.mcPdpLayoutMounted,
        ver: document.body.dataset.mcPdpLayoutVer,
        scriptVer: window.__MC_PDP_AUTH_CTA_FIX_VER__,
        titleInCol: !!(col && title && col.contains(title)),
        logoInCol: !!(col && logo && col.contains(logo)),
        priceInCol: !!(col && price && col.contains(price)),
        orderOk,
        colKids: kids,
        imgW: ir ? Math.round(ir.width) : 0,
        imgH: ir ? Math.round(ir.height) : 0,
        titleTop: title ? Math.round(title.getBoundingClientRect().top) : null,
        logoTop: logo ? Math.round(logo.getBoundingClientRect().top) : null,
        priceTop: price ? Math.round(price.getBoundingClientRect().top) : null,
      };
    }"""
    )


def main():
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, url in PAGES:
            page = browser.new_page(viewport={"width": 1400, "height": 1100})

            def route_js(route):
                if "mc-pdp-auth-cta-fix.js" in route.request.url:
                    route.fulfill(path=str(JS), content_type="application/javascript")
                else:
                    route.continue_()

            def route_css(route):
                if "custom-safe.css" in route.request.url:
                    route.fulfill(path=str(CSS), content_type="text/css")
                else:
                    route.continue_()

            page.route("**/*mc-pdp-auth-cta-fix.js*", route_js)
            page.route("**/*custom-safe.css*", route_css)
            page.goto(url, wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(14000)
            data = audit(page, name)
            out[name] = data
            shot = ROOT / "tmp" / f"verify-pdp37e-{name}.png"
            page.screenshot(path=str(shot), full_page=False)
            if name == "beanbag":
                before = page.evaluate(
                    "() => (document.getElementById('product_photo')||{}).src || ''"
                )
                pink = page.query_selector('.beanbag-swatch[data-option*="Pink"], .beanbag-swatch[data-option*="pink"]')
                if pink:
                    pink.click()
                    page.wait_for_timeout(800)
                after = page.evaluate(
                    "() => (document.getElementById('product_photo')||{}).src || ''"
                )
                out[name]["swatchChanged"] = before != after and "pink" in after.lower()
                out[name]["afterSrc"] = after
            page.close()
        browser.close()
    print(json.dumps(out, indent=2))
    ok = all(
        out[n]["titleInCol"]
        and out[n]["logoInCol"]
        and out[n]["priceInCol"]
        and out[n]["orderOk"]
        and out[n]["imgW"] >= 500
        for n in out
    )
    if out.get("beanbag"):
        ok = ok and out["beanbag"].get("swatchChanged", False)
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
