from playwright.sync_api import sync_playwright
import time

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm?cb=" + str(int(time.time()))

INIT = r"""
window.__ATC_LOG__ = [];
function ts() { return Math.round(performance.now()); }

// Track any element matching the ATC button being styled or moved
const _setAttr = Element.prototype.setAttribute;
Element.prototype.setAttribute = function(name, val) {
  if ((name === 'style' || name === 'class') && this.closest && this.closest('[id*="addtocart"],[id*="cart-button"],[name="btnAddToCart"],[name="btnaddtocart"]')) {
    window.__ATC_LOG__.push({t: ts(), op: 'attr:'+name, id: this.id||'', cls: this.className.toString().slice(0,60), val: String(val).slice(0,80) });
  }
  return _setAttr.apply(this, arguments);
};

const _appCSS = CSSStyleDeclaration.prototype.setProperty;
CSSStyleDeclaration.prototype.setProperty = function(prop, val, prio) {
  const el = this.parentRule ? null : (() => { try { return document.querySelector('[style]'); } catch(e){return null;}})();
  // trace via owner element check
  try {
    if (this._owner && this._owner.closest && this._owner.closest('[id*="addtocart"],[name="btnAddToCart"],[name="btnaddtocart"]')) {
      window.__ATC_LOG__.push({t: ts(), op: 'setProperty:'+prop, val: String(val).slice(0,40)});
    }
  } catch(e) {}
  return _appCSS.apply(this, arguments);
};

// Track appendChild/insertBefore on anything near ATC
const _ai = Node.prototype.appendChild;
Node.prototype.appendChild = function(n) {
  if (n && n.nodeType===1) {
    const id = n.id||''; const cls = (n.className&&n.className.toString)||'';
    if (/addtocart|cart.button|purchase.stack|atc/i.test(id) || (n.closest && n.closest('[id*="addtocart"]'))) {
      try { throw new Error('x'); } catch(e) {
        window.__ATC_LOG__.push({t:ts(), op:'appendChild', id:id, st:(e.stack||'').split('\n').slice(2,5).map(s=>s.trim()).join(' | ')});
      }
    }
  }
  return _ai.apply(this, arguments);
};
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1280,"height":900})
    page.add_init_script(INIT)
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    log = page.evaluate("() => window.__ATC_LOG__")
    # also grab computed style of ATC at end
    atc_info = page.evaluate("""() => {
      const sel = '#v65-product-addtocart, input[name="btnAddToCart"], input[name="btnaddtocart"]';
      const el = document.querySelector(sel);
      if (!el) return {found: false};
      const s = getComputedStyle(el);
      return {found: true, id: el.id, tag: el.tagName, bg: s.backgroundColor, color: s.color,
              display: s.display, parent: el.parentElement && el.parentElement.id, classes: el.className};
    }""")
    browser.close()

print("ATC element:", atc_info)
print("\nATC log entries:", len(log))
from collections import Counter
ops = Counter(e["op"] for e in log)
print("op counts:", ops)
print("\nFirst 30 log entries:")
for e in log[:30]:
    print("  @%dms op=%-30s id=%-20s val=%s st=%s" % (e["t"], e["op"], e.get("id",""), e.get("val","")[:60], e.get("st","")[:100]))
