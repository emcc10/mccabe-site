from playwright.sync_api import sync_playwright

PDP = "https://www.mccabestheaterandliving.com/Palliser-Asher-Power-Reclining-Sofa-p/asher%2041065.htm"

JS = """
() => {
  const imgs = document.querySelectorAll('#v65-product-parent img, #content_area img');
  const hits = [];
  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const lc = (src + ' ' + alt).toLowerCase();
    if (!/palliser/.test(lc)) continue;
    if (!/(logo|brand|vendor|manufacturer)/.test(lc)) continue;
    const chain = [];
    let p = img.parentElement;
    while (p && chain.length < 8) {
      chain.push(p.tagName + (p.id ? '#'+p.id : '') + (p.className ? '.'+String(p.className).split(' ').slice(0,2).join('.') : ''));
      p = p.parentElement;
    }
    hits.push({src: src.slice(-60), alt: alt.slice(0,50), w: img.naturalWidth||img.width, chain});
  }
  return hits;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    pg.goto(PDP, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(7000)
    import json
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
