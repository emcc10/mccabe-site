from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    posts = []

    def on_req(req):
        if req.method == "POST" and req.post_data:
            if "BB-FAUX" in (req.post_data or "") or "btnaddtocart" in (req.post_data or "").lower() or "SELECT___" in (req.post_data or ""):
                posts.append({"url": req.url, "post": req.post_data})

    pg.on("request", on_req)
    pg.goto(URL, wait_until="domcontentloaded", timeout=90000)
    pg.wait_for_timeout(14000)
    info = pg.evaluate(
        """() => ({
      atcs: [...document.querySelectorAll('input[name=btnaddtocart], button[name=btnaddtocart]')].map(b=>({type:b.type, name:b.name, form: b.form?.id, visible: b.offsetParent !== null})),
      form: document.getElementById('vCSS_mainform')?.id,
      selects: [...document.querySelectorAll('select')].map(s=>s.name)
    })"""
    )
    print("INFO", json.dumps(info, indent=2))
    pink = pg.query_selector('.beanbag-swatch[data-option*="Pink"]')
    if pink:
        pink.click()
        pg.wait_for_timeout(800)
    ok = pg.evaluate(
        """() => {
      const form = document.getElementById('vCSS_mainform');
      const btn = form?.querySelector('[name=btnaddtocart]');
      if (!btn) return {ok:false, reason:'no btn'};
      if (typeof addToCart === 'function') {
        return {ok: addToCart(form, btn), hasAddToCart: true};
      }
      btn.click();
      return {ok:true, clicked:true};
    }"""
    )
    print("ATC", ok)
    pg.wait_for_timeout(4000)
    print("POSTS", json.dumps(posts, indent=2))
    b.close()
