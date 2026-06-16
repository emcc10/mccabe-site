from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

AUDIT = r"""() => {
  const allSelects = [...document.querySelectorAll('select')].map(s => ({
    name: s.name,
    id: s.id,
    inOptionsTable: !!s.closest('#options_table'),
    inForm: !!s.closest('form'),
    formId: s.closest('form')?.id || '',
    display: getComputedStyle(s).display,
    n: s.options.length,
    sample: [...s.options].slice(0,3).map(o => ({v:o.value,t:o.text}))
  }));
  const ot = document.getElementById('options_table');
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    optionsTable: !!ot,
    optionsTableHtml: ot ? ot.outerHTML.slice(0, 500) : null,
    optionsTableParent: ot ? (ot.parentElement?.id || ot.parentElement?.tagName) : null,
    allSelects,
    productForm: [...document.querySelectorAll('form')].map(f => ({
      id: f.id,
      action: f.action?.slice(0,80),
      hasAtc: !!f.querySelector('[name=btnaddtocart]'),
      selects: f.querySelectorAll('select').length
    }))
  };
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1100})
    pg.goto(URL, wait_until="domcontentloaded", timeout=90000)
    pg.wait_for_timeout(14000)
    print(json.dumps(pg.evaluate(AUDIT), indent=2))
    b.close()
