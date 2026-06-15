import json
from playwright.sync_api import sync_playwright
URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
CSS = r"""
@media (min-width:992px){
  html body.mc-bean-bag-pdp #v65-product-parent tr:has(> td.mc-pdp-options-td) > td:has(#product_photo){
    flex: 0 0 auto !important; width: 660px !important; max-width: 660px !important;
  }
  html body.mc-bean-bag-pdp #v65-product-parent tr:has(> td.mc-pdp-options-td) > td.mc-pdp-options-td{
    flex: 1 1 auto !important; width: auto !important; max-width: none !important;
  }
}
"""
def measure(pg):
    return pg.evaluate(r"""()=>{const photo=document.getElementById('product_photo');const opt=document.querySelector('#v65-product-parent td.mc-pdp-options-td');const r=e=>e?{l:Math.round(e.getBoundingClientRect().left),r:Math.round(e.getBoundingClientRect().right),w:Math.round(e.getBoundingClientRect().width)}:null;return{opt:r(opt),photo:r(photo),gap:(photo&&opt)?Math.round(opt.getBoundingClientRect().left-photo.getBoundingClientRect().right):null,hasSupport:CSS.supports('selector(:has(*))')};}""")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":1400})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000); pg.wait_for_timeout(12000)
    print("BASE:", json.dumps(measure(pg)))
    pg.add_style_tag(content=CSS); pg.wait_for_timeout(800)
    print("HAS :", json.dumps(measure(pg)))
    b.close()
