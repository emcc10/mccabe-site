import json
from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

CANDIDATES = {
  "A_media670_optgrow": r"""
@media (min-width:992px){
  html body.mc-bean-bag-pdp .mc-pdp-hero-media-col { flex: 0 0 670px !important; width:670px !important; max-width:670px !important; }
  html body.mc-bean-bag-pdp td.mc-pdp-options-td { flex: 1 1 auto !important; width:auto !important; max-width:none !important; }
}
""",
  "B_media55pct_opt45pct": r"""
@media (min-width:992px){
  html body.mc-bean-bag-pdp .mc-pdp-hero-media-col { flex: 0 0 52% !important; width:52% !important; max-width:52% !important; }
  html body.mc-bean-bag-pdp td.mc-pdp-options-td { flex: 0 0 46% !important; width:46% !important; max-width:46% !important; }
}
""",
}

def measure(pg):
    return pg.evaluate(r"""() => {
      const photo=document.getElementById('product_photo');
      const optTd=document.querySelector('#v65-product-parent td.mc-pdp-options-td');
      const media=optTd?optTd.previousElementSibling:null;
      const r=(e)=>e?{l:Math.round(e.getBoundingClientRect().left),r:Math.round(e.getBoundingClientRect().right),w:Math.round(e.getBoundingClientRect().width)}:null;
      return {
        mediaTagged: media?media.classList.contains('mc-pdp-hero-media-col'):null,
        media:r(media), optTd:r(optTd), photo:r(photo),
        gap:(photo&&optTd)?Math.round(optTd.getBoundingClientRect().left-photo.getBoundingClientRect().right):null,
      };
    }""")

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 1400})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(12000)
    print("BASELINE:", json.dumps(measure(pg)))
    for name, css in CANDIDATES.items():
        h = pg.add_style_tag(content=css)
        pg.wait_for_timeout(700)
        print(name, ":", json.dumps(measure(pg)))
        pg.evaluate("(el)=>el.remove()", h)
        pg.wait_for_timeout(400)
    b.close()
