from playwright.sync_api import sync_playwright
import time

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm?cb=" + str(int(time.time()))

INIT = r"""
window.__MOVES__ = [];
function trace() {
  try { throw new Error('x'); } catch(e) {
    return (e.stack||'').split('\n').slice(2,6).map(s=>s.trim()).join(' | ');
  }
}
function isTracked(node){
  if(!node || node.nodeType!==1) return null;
  if(node.id==='mc-pdp-features') return 'features';
  if(node.id==='mc-pdp-qty-row') return 'qty';
  if(node.id==='mc-pdp-price-atc-row') return 'atc-row';
  if(node.id==='mc-pdp-price-stack-host') return 'price-host';
  if(node.id==='beanbag-swatch-wrapper') return 'swatch';
  return null;
}
const ai = Node.prototype.appendChild;
Node.prototype.appendChild = function(n){ const t=isTracked(n); if(t) window.__MOVES__.push({op:'append:'+t, parent:(this.id||this.className||this.tagName), st:trace()}); return ai.apply(this, arguments); };
const ib = Node.prototype.insertBefore;
Node.prototype.insertBefore = function(n,r){ const t=isTracked(n); if(t) window.__MOVES__.push({op:'insertBefore:'+t, parent:(this.id||this.className||this.tagName), st:trace()}); return ib.apply(this, arguments); };
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1280,"height":900})
    page.add_init_script(INIT)
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    time.sleep(9)
    moves = page.evaluate("() => window.__MOVES__")
    browser.close()

from collections import Counter
print("TOTAL tracked moves:", len(moves))
c = Counter((m["op"]+" -> "+str(m["parent"])) for m in moves)
print("\n=== move counts (op -> parent) ===")
for k,v in c.most_common():
    print(f"  {v:4d}  {k}")
print("\n=== sample stacks per op ===")
seen=set()
for m in moves:
    key=m["op"]
    if key in seen: continue
    seen.add(key)
    print(f"\n[{m['op']}] parent={m['parent']}\n   {m['st']}")
