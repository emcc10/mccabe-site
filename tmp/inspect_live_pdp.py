from playwright.sync_api import sync_playwright
import json

URLS = [
    "https://www.mccabestheaterandliving.com/Double-Ruched-Faux-Fur-Throw-Blankets-p/double%20ruched%20faux%20fur%20throw%20blankets.htm",
    "https://www.mccabestheaterandliving.com/Palliser-Asher-Power-Reclining-Sofa-p/asher%2041065.htm",
    "https://www.mccabestheaterandliving.com/Trento-Grey-Leather-Sofa-p/trento%20grey%20leather%20sofa.htm",
]

JS = """
() => {
  const css = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map(l => l.href).filter(h => /custom-safe|mc-plp|body-last/i.test(h)).slice(-5);
  const scripts = [...document.querySelectorAll('script[src]')]
    .map(s => s.src).filter(h => /mc-pdp-auth|template_266|266/i.test(h)).slice(-8);
  const out = {
    title: document.title,
    bodyClass: document.body.className,
    css,
    scripts,
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    logoFn: typeof window.mcPlaceBrandLogoAboveTitle,
    alignFn: typeof window.mcSyncPdpHeroTopAlign,
    brandLogo: !!document.getElementById('mc-pdp-brand-logo'),
    titleRight: !!document.getElementById('mc-pdp-title-right'),
  };
  const sels = ['#mc-pdp-brand-logo','#mc-pdp-title-right','img#product_photo',
    '.mc-atc-button-wrap','input[name="btnaddtocart"]','#mc-pdp-features .mc-pdp-features__heading'];
  out.elements = {};
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) { out.elements[sel] = null; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.elements[sel] = {
      top: Math.round(r.top), left: Math.round(r.left),
      fontSize: cs.fontSize, border: cs.border, borderRadius: cs.borderRadius,
      marginTop: cs.marginTop,
    };
  }
  const mediaImgs = [...document.querySelectorAll('td.mc-pdp-media-td img, #product_photo_td img')]
    .slice(0,6).map(i => ({id: i.id, src: (i.src||'').slice(-70), w: i.naturalWidth||i.width}));
  out.mediaImgs = mediaImgs;
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    for url in URLS:
        print("\\n===", url.split("/")[-1][:50], "===")
        try:
            r = pg.goto(url, wait_until="domcontentloaded", timeout=60000)
            pg.wait_for_timeout(8000)
            data = pg.evaluate(JS)
            print("status:", r.status if r else "?")
            print(json.dumps(data, indent=2))
        except Exception as e:
            print("ERR:", e)
    b.close()
