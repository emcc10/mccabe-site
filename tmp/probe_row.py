import json
from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

JS = r"""
() => {
  const optTd = document.querySelector('#v65-product-parent td.mc-pdp-options-td');
  const info = (el) => { if(!el) return null; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    return {tag:el.tagName,id:el.id||'',cls:(typeof el.className==='string'?el.className:''),l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width),disp:cs.display,pos:cs.position,fb:cs.flexBasis,fg:cs.flexGrow,fs:cs.flexShrink}; };
  const out = {};
  const tr = optTd ? optTd.closest('tr') : null;
  out.tr = info(tr);
  out.trKids = tr ? [...tr.children].map(info) : null;
  let p = tr ? tr.parentElement : null; const chain=[];
  for (let i=0;i<5 && p;i++){ chain.push(info(p)); p=p.parentElement; }
  out.ancestors = chain;
  const parent = document.getElementById('v65-product-parent');
  out.parent = info(parent);
  out.parentDisp = parent ? getComputedStyle(parent).display : null;
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 1400})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(9000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
