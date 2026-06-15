from playwright.sync_api import sync_playwright
import time

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm?cb=" + str(int(time.time()))

INIT = r"""
window.__ATC_SNAPSHOTS__ = [];
window.__ATC_STYLE_LOG__ = [];

function snapAtc() {
  // Find the actual ATC button - Volusion uses input.vCSS_input_addtocart
  const btn = document.querySelector('input.vCSS_input_addtocart, input[name="btnAddToCart"], input[name="btnaddtocart"], button[name="btnaddtocart"]');
  if (!btn) return;
  const s = getComputedStyle(btn);
  const wrap = btn.closest('[id*="addtocart"],[id*="purchase"],[id*="atc"]') || btn.parentElement;
  const wrapId = wrap ? (wrap.id || wrap.className.toString().slice(0,40)) : '?';
  return {
    t: Math.round(performance.now()),
    bg: s.backgroundColor, color: s.color, display: s.display,
    opacity: s.opacity, visibility: s.visibility,
    parentId: wrapId,
    top: Math.round(btn.getBoundingClientRect().top + scrollY)
  };
}

// Poll every 200ms
var _poll = setInterval(function() {
  var s = snapAtc();
  if (!s) return;
  var prev = window.__ATC_SNAPSHOTS__.slice(-1)[0];
  // record if anything changed
  if (!prev || prev.bg !== s.bg || prev.color !== s.color || prev.display !== s.display ||
      prev.opacity !== s.opacity || prev.visibility !== s.visibility ||
      prev.parentId !== s.parentId || Math.abs(prev.top - s.top) > 2) {
    window.__ATC_SNAPSHOTS__.push(s);
  }
}, 200);

// Also intercept inline style writes on the button wrapper
const _sp = CSSStyleDeclaration.prototype.setProperty;
CSSStyleDeclaration.prototype.setProperty = function(prop, val, prio) {
  try {
    const el = this._ownerElement || this._element;
    if (el && el.closest) {
      const btn = el.closest('.mc-atc-button-wrap, .mc-pdp-purchase-stack, #mc-pdp-purchase-stack') ||
                  (el.matches && el.matches('[id*="purchase"],[id*="atc"],[class*="atc"],[class*="purchase"]') ? el : null);
      if (btn) {
        try { throw new Error(); } catch(e2) {
          window.__ATC_STYLE_LOG__.push({
            t: Math.round(performance.now()), prop, val: String(val),
            target: el.id || el.className.toString().slice(0,40),
            st: (e2.stack||'').split('\n').slice(2,5).map(s=>s.trim()).join(' | ')
          });
        }
      }
    }
  } catch(e) {}
  return _sp.apply(this, arguments);
};
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1280,"height":900})
    page.add_init_script(INIT)
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    snaps = page.evaluate("() => window.__ATC_SNAPSHOTS__")
    slog  = page.evaluate("() => window.__ATC_STYLE_LOG__")
    browser.close()

print("=== ATC button style snapshots (changes only) ===")
for s in snaps:
    print("  @%dms  bg=%-30s color=%-20s display=%-8s op=%-4s vis=%-8s parent=%s top=%d" % (
        s["t"], s["bg"], s["color"], s["display"], s["opacity"], s["visibility"], s["parentId"], s["top"]))

print("\n=== inline setProperty calls on ATC wrapper (%d total) ===" % len(slog))
from collections import Counter
by_prop = Counter(e["prop"]+"="+e["val"] for e in slog)
print("  most common:", by_prop.most_common(15))
print("\n  first 20 unique stacks:")
seen = set()
for e in slog:
    k = e["prop"]
    if k in seen: continue
    seen.add(k)
    print("  @%dms prop=%-25s val=%-20s target=%s\n    %s" % (e["t"], e["prop"], e["val"], e["target"], e["st"]))
