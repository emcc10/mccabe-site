from playwright.sync_api import sync_playwright
import json, time, io

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm?cb=" + str(int(time.time()))
LOCAL_JS = "vspfiles/js/mc-pdp-auth-cta-fix.js"

with io.open(LOCAL_JS, "r", encoding="utf-8") as f:
    local_src = f.read()

TRACK = {
    "main_img": "#product_photo",
    "swatch_wrap": "#beanbag-swatch-wrapper",
    "price_host": "#mc-pdp-price-stack-host",
    "features": "#mc-pdp-features",
    "qty": "#mc-pdp-qty-row, input[name='QtyOrdered']",
    "option_block": "#mc-pdp-option-block",
}
JS_TRACK = ("""
() => { const sels = %s; const out = {};
  for (const k in sels){ let el=document.querySelector(sels[k]);
    if(!el){out[k]=null;continue;} const r=el.getBoundingClientRect();
    out[k]={top:Math.round(r.top+scrollY),left:Math.round(r.left+scrollX),w:Math.round(r.width),h:Math.round(r.height)};}
  return out; }
""" % json.dumps(TRACK))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1280,"height":900})

    def handle(route):
        u = route.request.url
        if "mc-pdp-auth-cta-fix.js" in u:
            route.fulfill(status=200, content_type="application/javascript", body=local_src)
        else:
            route.continue_()
    page.route("**/mc-pdp-auth-cta-fix.js*", handle)

    page.add_init_script("""
      window.__CLS__=0; window.__SHIFTS__=[];
      new PerformanceObserver((l)=>{for(const e of l.getEntries()){
        if(!e.hadRecentInput){window.__CLS__+=e.value;
          let srcs=(e.sources||[]).map(s=>{ let n=s.node; let id=n&&n.id?('#'+n.id):''; let cl=n&&n.className&&n.className.toString?('.'+n.className.toString().trim().split(/\\s+/).slice(0,2).join('.')):''; let tag=n&&n.tagName?n.tagName.toLowerCase():(n&&n.nodeName||'?'); return tag+id+cl+' ['+Math.round(s.previousRect.top)+'->'+Math.round(s.currentRect.top)+']';});
          window.__SHIFTS__.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),src:srcs});}}
      }).observe({type:'layout-shift',buffered:true});
    """)
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)

    samples=[]; t0=time.time()
    while time.time()-t0 < 9:
        try: snap=page.evaluate(JS_TRACK)
        except Exception as e: snap={"err":str(e)}
        samples.append({"t":round(time.time()-t0,2),"p":snap}); time.sleep(0.3)
    cls=page.evaluate("()=>({cls:window.__CLS__,shifts:window.__SHIFTS__})")
    # confirm our local file was served
    served = page.evaluate("()=> (window.__MC_PDP_AUTH_CTA_FIX_VER__||'?')")
    browser.close()

print("served VERSION flag:", served)
print("=== CLS:", round(cls["cls"],4), "(>0.1 poor); shift events:", len(cls["shifts"]))
big=[s for s in cls["shifts"] if s["v"]>0.02]
print("    BIG shifts (>0.02):")
for s in big: print("      @%dms v=%s  %s" % (s["t"], s["v"], s.get("src")))
for k in TRACK:
    pos=[(s["t"],s["p"][k]["top"],s["p"][k]["left"]) for s in samples if isinstance(s["p"],dict) and s["p"].get(k)]
    if not pos: print(f"[{k}] NOT FOUND"); continue
    moves=sum(1 for i in range(1,len(pos)) if abs(pos[i-1][1]-pos[i][1])>2 or abs(pos[i-1][2]-pos[i][2])>2)
    print(f"[{k}] start top={pos[0][1]} end top={pos[-1][1]} moves={moves}")
