from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    found = []

    def on_response(resp):
        if "bb-faux" in resp.url.lower() or "productdetails" in resp.url.lower():
            if resp.request.resource_type == "document":
                pass

    pg.on("framenavigated", lambda frame: None)

    snapshots = []

    def snap(label):
        d = pg.evaluate(
            """() => ({
          label: arguments[0],
          optionsTable: !!document.getElementById('options_table'),
          selects: document.querySelectorAll('select').length,
          selectNames: [...document.querySelectorAll('select')].map(s=>s.name).slice(0,5)
        })""",
            label,
        )
        snapshots.append(d)

    pg.goto(URL, wait_until="commit", timeout=90000)
    for ms in [0, 500, 1000, 2000, 5000, 8000, 14000]:
        pg.wait_for_timeout(ms if ms else 1)
        snapshots.append(
            pg.evaluate(
                f"""() => ({{
              t: {ms},
              optionsTable: !!document.getElementById('options_table'),
              selects: document.querySelectorAll('select').length,
              names: [...document.querySelectorAll('select')].map(s=>s.name),
              ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || ''
            }})"""
            )
        )
    # raw source check
    html = pg.content()
    has_ot = 'id="options_table"' in html or "id='options_table'" in html
    has_select = "SELECT___" in html or "select___" in html
    print(json.dumps({"snapshots": snapshots, "htmlHasOptionsTable": has_ot, "htmlHasSelect": has_select}, indent=2))
    b.close()
