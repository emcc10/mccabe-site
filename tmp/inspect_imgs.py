from playwright.sync_api import sync_playwright
import json

URLS = [
    "https://www.mccabestheaterandliving.com/Trento-Grey-Leather-Sofa-p/trento%20grey%20leather%20sofa.htm",
    "https://www.mccabestheaterandliving.com/product-p/ss-noah-tan-sleeper-sofa.htm",
]

JS = """
() => {
  const imgs = Array.from(document.querySelectorAll('#v65-product-parent img')).map(img => {
    const r = img.getBoundingClientRect();
    if (r.width < 20 || r.height < 10) return null;
    const inMedia = !!(img.closest('.mc-pdp-media-td, #product_photo_td, td:has(#product_photo)'));
    const inOptions = !!(img.closest('.mc-pdp-options-td, td:has(.colors_pricebox), td:has(#mc-pdp-title-right)'));
    return {
      id: img.id || '',
      src: (img.currentSrc||img.src||'').split('/').pop().slice(0,50),
      w: Math.round(r.width), h: Math.round(r.height),
      top: Math.round(r.top), left: Math.round(r.left),
      inMedia, inOptions
    };
  }).filter(Boolean);
  return imgs.slice(0, 20);
}
"""

for url in URLS:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1400, "height": 1000})
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(6000)
        print("===", url.split("/")[-1], "===")
        for row in pg.evaluate(JS):
            if row['id'] != 'product_photo' and not row['id'].startswith('alternate_'):
                print(row)
        b.close()
