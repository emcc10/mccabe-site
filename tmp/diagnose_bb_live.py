from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1100})
    pg.goto(URL, wait_until="domcontentloaded", timeout=90000)
    pg.wait_for_timeout(12000)

    before = pg.evaluate(
        """() => {
      const img = document.getElementById('product_photo');
      const r = img ? img.getBoundingClientRect() : null;
      const cs = img ? getComputedStyle(img) : null;
      const selects = [...document.querySelectorAll('#options_table select, #v65-product-parent select')].map(s => ({
        name: s.name, id: s.id, opts: s.options?.length, hidden: s.offsetParent===null, display: getComputedStyle(s).display
      }));
      const swatches = [...document.querySelectorAll('.beanbag-swatch')].map(s => ({
        opt: s.getAttribute('data-option'),
        bg: getComputedStyle(s).backgroundImage?.slice(0,80)
      }));
      const mediaTd = document.querySelector('td.mc-pdp-media-td, #product_photo_td');
      const alt = document.getElementById('altviews');
      return {
        ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
        imgSrc: img?.src,
        imgW: r ? Math.round(r.width) : null,
        imgH: r ? Math.round(r.height) : null,
        imgCssW: cs?.width,
        imgCssMaxW: cs?.maxWidth,
        imgCssDisplay: cs?.display,
        mediaTdClass: mediaTd?.className,
        altviewsParent: alt?.parentElement?.id || alt?.parentElement?.className,
        altviewsDisplay: alt ? getComputedStyle(alt).display : null,
        altviewsFlex: alt ? getComputedStyle(alt).flexDirection : null,
        selectCount: selects.length,
        selects,
        swatchCount: swatches.length,
        swatches,
        bbImgBound: document.documentElement.dataset.mcBbImgBound,
        optionsTable: !!document.getElementById('options_table'),
      };
    }"""
    )
    print("BEFORE", json.dumps(before, indent=2))

    pink = pg.query_selector('.beanbag-swatch[data-option="Pink"]')
    navy = pg.query_selector('.beanbag-swatch[data-option="Navy"]')
    target = pink or navy or pg.query_selector(".beanbag-swatch")
    if target:
        opt = target.get_attribute("data-option")
        print("CLICKING", opt)
        target.click()
        pg.wait_for_timeout(2000)
    after = pg.evaluate(
        """() => {
      const img = document.getElementById('product_photo');
      return {
        imgSrc: img?.src,
        imgW: img ? Math.round(img.getBoundingClientRect().width) : null,
        active: document.querySelector('.beanbag-swatch.active')?.getAttribute('data-option'),
        selVal: (document.querySelector('#options_table select')||{}).value,
        selText: document.querySelector('#options_table select')?.selectedOptions?.[0]?.text,
      };
    }"""
    )
    print("AFTER", json.dumps(after, indent=2))
    pg.screenshot(path="tmp/diagnose-bb-live.png")
    b.close()
