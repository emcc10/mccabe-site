from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
hits = []

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()

    def on_req(req):
        u = req.url.lower()
        if any(k in u for k in ["option", "product", "ajax", "volusion", "addtocart"]):
            if req.method == "POST" or "option" in u:
                hits.append({"method": req.method, "url": req.url[:120]})

    pg.on("request", on_req)
    pg.goto(URL, wait_until="networkidle", timeout=120000)
    pg.wait_for_timeout(5000)
    d = pg.evaluate(
        """() => ({
      selects: [...document.querySelectorAll('select')].map(s=>s.name),
      globalOpts: typeof window.ProductOption !== 'undefined',
      keys: Object.keys(window).filter(k=>/option|volusion|product/i.test(k)).slice(0,30)
    })"""
    )
    b.close()

print(json.dumps({"after_load": d, "requests": hits[:20]}, indent=2))
