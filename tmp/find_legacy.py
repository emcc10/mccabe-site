import json
from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
JS = r"""
() => {
  const col = document.querySelector('#v65-product-parent td.mc-pdp-options-td');
  const chain = (el) => { const out=[]; let n=el; for(let i=0;i<8&&n;i++){ out.push((n.tagName||'')+(n.id?'#'+n.id:'')+(typeof n.className==='string'&&n.className?'.'+n.className.trim().split(/\s+/).slice(0,2).join('.'):'')); n=n.parentElement;} return out; };
  // legacy price span with 329.00
  let legacy=null;
  document.querySelectorAll('#v65-product-parent span, #v65-product-parent div').forEach(el=>{
    if(el.childElementCount===0){const t=(el.textContent||'').replace(/\s+/g,' ').trim(); if(/^\$?329(\.00)?$/.test(t)){const r=el.getBoundingClientRect(); if(r.width>0 && t==='329.00'){ if(!legacy) legacy={txt:t,top:Math.round(r.top),inCol:col?col.contains(el):null,chain:chain(el)};}}}
  });
  const msg=document.getElementById('messaging-element');
  const box=document.querySelector('#v65-product-parent .colors_pricebox');
  const r=(e)=>e?{top:Math.round(e.getBoundingClientRect().top),inCol:col?col.contains(e):null,chain:chain(e)}:null;
  return { legacy, messaging:r(msg), pricebox:r(box) };
}
"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":1400})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000); pg.wait_for_timeout(12000)
    print(json.dumps(pg.evaluate(JS), indent=2)); b.close()
