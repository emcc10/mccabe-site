from playwright.sync_api import sync_playwright
import json
url='https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm'
js=r'''
() => {
  const sel = document.querySelector('#options_table select, #v65-product-parent select');
  const out = { ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ };
  if (!sel) return { ...out, err: 'no select' };
  const chain=[]; let n=sel;
  for (let i=0;i<8 && n;i++) {
    const r=n.getBoundingClientRect();
    chain.push({tag:n.tagName,id:n.id||'',cls:typeof n.className==='string'?n.className:'',top:Math.round(r.top),w:Math.round(r.width),txt:(n.textContent||'').replace(/\s+/g,' ').trim().slice(0,80)});
    n=n.parentElement;
  }
  const labels=[...document.querySelectorAll('label, .productnamecolorSMALL, .colors_productname, font, span, div')]
    .filter(el => {
      const t=(el.textContent||'').replace(/\s+/g,' ').trim();
      return /choose color|selected color|color:/i.test(t) && el.getBoundingClientRect().width > 0;
    })
    .slice(0,10)
    .map(el => ({tag:el.tagName,id:el.id||'',cls:typeof el.className==='string'?el.className:'',top:Math.round(el.getBoundingClientRect().top),txt:(el.textContent||'').replace(/\s+/g,' ').trim()}));
  const features=document.getElementById('mc-pdp-features');
  return {
    ...out,
    select:{name:sel.name||'',id:sel.id||'',top:Math.round(sel.getBoundingClientRect().top),value:sel.value,text:sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text},
    chain,
    labels,
    features: features ? {top:Math.round(features.getBoundingClientRect().top), parent: features.parentElement && features.parentElement.tagName} : null,
    colKids:[...document.querySelector('#v65-product-parent td.mc-pdp-options-td').children].map(el=>({tag:el.tagName,id:el.id||'',cls:typeof el.className==='string'?el.className:'',top:Math.round(el.getBoundingClientRect().top),txt:(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,50)}))
  };
}
'''
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width':1440,'height':1300})
    page.goto(url, wait_until='domcontentloaded', timeout=60000)
    page.wait_for_timeout(12000)
    print(json.dumps(page.evaluate(js), indent=2))
    b.close()
