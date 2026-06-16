from playwright.sync_api import sync_playwright
import json
import time


def check(name, url):
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1400, "height": 1100})
        pg.goto(url, wait_until="domcontentloaded", timeout=90000)
        pg.wait_for_timeout(15000)
        base = pg.evaluate(
            """() => {
          const col=document.querySelector('td.mc-pdp-options-td');
          const want=['mc-pdp-title-right','mc-pdp-brand-logo','mc-pdp-price-stack-host','messaging-element','mc-pdp-features','beanbag-swatch-wrapper','mc-configured-color-swatch-wrapper','mc-pdp-description-below-features','mc-pdp-purchase-stack'];
          const tops=want.filter(id=>{const el=document.getElementById(id); return el&&col&&col.contains(el);})
            .map(id=>({id,top:Math.round(document.getElementById(id).getBoundingClientRect().top)}))
            .sort((a,b)=>a.top-b.top).map(x=>x.id);
          const atc=document.querySelector('#mc-pdp-purchase-stack input[name=btnaddtocart]');
          const wrap=atc?.closest('.mc-atc-button-wrap');
          const qty=document.querySelector('#mc-pdp-qty-row input');
          return {
            ver:window.__MC_PDP_AUTH_CTA_FIX_VER__,
            layoutVer:document.body?.dataset?.mcPdpLayoutVer,
            tops,
            titleDelta:Math.round((document.getElementById('mc-pdp-title-right')?.getBoundingClientRect().top||0)-(document.getElementById('product_photo')?.getBoundingClientRect().top||0)),
            gap:col&&document.getElementById('product_photo')?Math.round(col.getBoundingClientRect().left-document.getElementById('product_photo').getBoundingClientRect().right):null,
            wrapBg:wrap?getComputedStyle(wrap).backgroundColor:null,
            btnBg:atc?getComputedStyle(atc).backgroundColor:null,
            btnColor:atc?getComputedStyle(atc).color:null,
            qtyBeside: !!(qty&&atc&&qty.getBoundingClientRect().right<=atc.getBoundingClientRect().left+6),
          };
        }"""
        )
        ids = ["mc-pdp-price-stack-host", "mc-pdp-features"]
        b0 = pg.evaluate(
            """(ids)=>ids.map(id=>{const el=document.getElementById(id); if(!el) return null; const r=el.getBoundingClientRect(); return [Math.round(r.top),Math.round(r.left)];})""",
            ids,
        )
        moves = 0
        for _ in range(12):
            time.sleep(1)
            b1 = pg.evaluate(
                """(ids)=>ids.map(id=>{const el=document.getElementById(id); if(!el) return null; const r=el.getBoundingClientRect(); return [Math.round(r.top),Math.round(r.left)];})""",
                ids,
            )
            if b1 != b0:
                moves += 1
                b0 = b1
        base["flicker12s"] = moves
        if name == "beanbag":
            sw = pg.query_selector(".beanbag-swatch:nth-child(2)")
            if sw:
                src0 = pg.evaluate("() => document.getElementById('product_photo')?.src || ''")
                sw.click()
                pg.wait_for_timeout(1500)
                src1 = pg.evaluate("() => document.getElementById('product_photo')?.src || ''")
                base["swatchChanged"] = src0 != src1 and "bb-fauxfur" in src1
        pink = pg.query_selector('.beanbag-swatch[data-option="Pink"]')
        if pink:
            src0 = pg.evaluate("() => document.getElementById('product_photo')?.src || ''")
            pink.click()
            pg.wait_for_timeout(2000)
            src1 = pg.evaluate("() => document.getElementById('product_photo')?.src || ''")
            base["pinkSwatchChanged"] = src0 != src1 and "pink" in src1.lower()
        pg.screenshot(path=f"tmp/verify36-{name}.png")
        b.close()
        return base


for n, u in [
    ("blanket", "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"),
    ("beanbag", "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"),
]:
    print(n, json.dumps(check(n, u), indent=2))
