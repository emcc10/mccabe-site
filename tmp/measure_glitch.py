from playwright.sync_api import sync_playwright
import json, time, sys

slug = sys.argv[1] if len(sys.argv) > 1 else "bb-faux-fur"
URL = "https://www.mccabestheaterandliving.com/product-p/%s.htm?cb=%d" % (slug, int(time.time()))
print("URL:", URL)

TRACK = {
    "main_img": "#product_photo",
    "atc": "#v65-product-addtocart, input[name='btnAddToCart'], [id*='addtocart'] input[type='image'], .v65-product-addtocart",
    "swatch_wrap": "#beanbag-swatch-wrapper",
    "price_host": "#mc-pdp-price-stack-host",
    "features": "#mc-pdp-features",
    "qty": "#mc-pdp-qty-row, input[name='QtyOrdered']",
}

JS_TRACK = """
() => {
  const sels = %s;
  const out = {};
  for (const k in sels) {
    let el = document.querySelector(sels[k]);
    if (!el) { out[k] = null; continue; }
    const r = el.getBoundingClientRect();
    out[k] = { top: Math.round(r.top + window.scrollY), left: Math.round(r.left + window.scrollX), w: Math.round(r.width), h: Math.round(r.height) };
  }
  return out;
}
""" % json.dumps(TRACK)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    # measure cumulative layout shift
    page.add_init_script("""
      window.__CLS__ = 0; window.__SHIFTS__ = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (!e.hadRecentInput) { window.__CLS__ += e.value;
            window.__SHIFTS__.push({t: Math.round(e.startTime), v: +e.value.toFixed(4)}); }
        }
      }).observe({type:'layout-shift', buffered:true});
    """)
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)

    samples = []
    t0 = time.time()
    while time.time() - t0 < 9:
        try:
            snap = page.evaluate(JS_TRACK)
        except Exception as e:
            snap = {"err": str(e)}
        samples.append({"t": round(time.time() - t0, 2), "p": snap})
        time.sleep(0.3)

    cls = page.evaluate("() => ({cls: window.__CLS__, shifts: window.__SHIFTS__})")
    browser.close()

# Report movement per element
print("=== CLS:", round(cls["cls"], 4), " (>0.1 = poor) ; shift events:", len(cls["shifts"]))
late = [s for s in cls["shifts"] if s["t"] > 1500]
print("    layout shifts AFTER 1.5s:", late[:20])

for k in TRACK:
    positions = []
    for s in samples:
        v = s["p"].get(k) if isinstance(s["p"], dict) else None
        if v: positions.append((s["t"], v["top"], v["left"], v["w"], v["h"]))
    if not positions:
        print(f"[{k}] NOT FOUND")
        continue
    moves = []
    for i in range(1, len(positions)):
        a, b = positions[i-1], positions[i]
        if abs(a[1]-b[1]) > 2 or abs(a[2]-b[2]) > 2 or abs(a[3]-b[3]) > 2 or abs(a[4]-b[4]) > 2:
            moves.append((b[0], f"top {a[1]}->{b[1]} left {a[2]}->{b[2]} w {a[3]}->{b[3]} h {a[4]}->{b[4]}"))
    print(f"[{k}] start top={positions[0][1]} left={positions[0][2]} | end top={positions[-1][1]} left={positions[-1][2]} | moves={len(moves)}")
    for m in moves[:12]:
        print(f"      @{m[0]}s {m[1]}")
