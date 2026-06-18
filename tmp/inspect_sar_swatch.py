from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"

JS = r"""
() => {
  const out = {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    bodyClass: document.body.className,
    scripts: [...document.querySelectorAll('script[src*="mc-pdp-auth"]')].map(s => s.src),
    css: [...document.querySelectorAll('link[href*="custom-safe"]')].map(l => l.href),
    picker: !!document.querySelector('.mc-saranoni-color-picker'),
    pickerThumbs: document.querySelectorAll('.mc-saranoni-color-picker__thumbs a').length,
    wrap: !!document.getElementById('mc-configured-color-swatch-wrapper'),
    swatches: document.querySelectorAll('.mc-configured-color-swatch').length,
    visibleSwatches: [...document.querySelectorAll('.mc-configured-color-swatch')].filter(
      b => b.style.display !== 'none'
    ).length,
    swatchesReady: document.body.classList.contains('mc-saranoni-swatches-ready'),
    saranoniPdp: document.body.classList.contains('mc-saranoni-pdp'),
    select: !!document.querySelector('select[name*="SAR-DBL-RCH-FX-FUR"]'),
    selectDisplay: (() => {
      const s = document.querySelector('select[name*="SAR-DBL-RCH-FX-FUR"]');
      if (!s) return null;
      const cs = getComputedStyle(s);
      return { opacity: cs.opacity, display: cs.display, hidden: s.dataset.mcConfiguredColorHidden };
    })(),
    optionsTableDisplay: (() => {
      const t = document.getElementById('options_table');
      if (!t) return null;
      const cs = getComputedStyle(t);
      return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity };
    })(),
  };
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(12000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
