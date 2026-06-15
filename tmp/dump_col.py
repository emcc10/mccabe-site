import json
from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

JS = r"""
() => {
  const col = document.querySelector('#v65-product-parent td.mc-pdp-options-td');
  if (!col) return {err:'nocol'};
  const desc = (el, depth) => {
    const r = el.getBoundingClientRect();
    const txt = (el.innerText||'').replace(/\s+/g,' ').trim().slice(0,40);
    return {
      d: depth,
      tag: el.tagName,
      id: el.id||'',
      cls: (typeof el.className==='string'?el.className:'').slice(0,40),
      top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      disp: getComputedStyle(el).display,
      txt: txt,
    };
  };
  // direct children of col
  const kids = [...col.children].map(c => desc(c, 0));
  // find all price-ish elements anywhere
  const prices = [];
  document.querySelectorAll('#v65-product-parent *').forEach(el => {
    const t = (el.childElementCount===0 ? (el.textContent||'') : '').replace(/\s+/g,' ').trim();
    if (/^\$?\d{2,4}(\.\d{2})?$/.test(t) && t.length<10) {
      const r = el.getBoundingClientRect();
      if (r.width>0) prices.push({tag:el.tagName,id:el.id||'',cls:(typeof el.className==='string'?el.className:'').slice(0,30),txt:t,top:Math.round(r.top),inCol:col.contains(el)});
    }
  });
  return {
    colKidsCount: col.children.length,
    colKids: kids,
    prices: prices,
    priceHostParent: (function(){const p=document.getElementById('mc-pdp-price-stack-host');return p&&p.parentElement?{tag:p.parentElement.tagName,id:p.parentElement.id,cls:(typeof p.parentElement.className==='string'?p.parentElement.className:'')}:null;})(),
    rowParent: (function(){const p=document.getElementById('mc-pdp-price-atc-row');return p&&p.parentElement?{tag:p.parentElement.tagName,id:p.parentElement.id,cls:(typeof p.parentElement.className==='string'?p.parentElement.className:'')}:null;})(),
    logoParent: (function(){const p=document.getElementById('mc-pdp-brand-logo');return p&&p.parentElement?{tag:p.parentElement.tagName,id:p.parentElement.id,cls:(typeof p.parentElement.className==='string'?p.parentElement.className:'')}:null;})(),
    featParent: (function(){const p=document.getElementById('mc-pdp-features');return p&&p.parentElement?{tag:p.parentElement.tagName,id:p.parentElement.id,cls:(typeof p.parentElement.className==='string'?p.parentElement.className:'')}:null;})(),
  };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 1400})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(12000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
