from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/bb-nest.htm"

JS = """
() => {
  const sw = [...document.querySelectorAll('img[src*="/swatches/"], img[src*="swatches/"]')].slice(0, 8).map(i => ({
    src: i.src, id: i.id, cls: i.className, parent: i.parentElement && i.parentElement.tagName,
    pe: i.style.pointerEvents, display: getComputedStyle(i).display, vis: getComputedStyle(i).visibility
  }));
  const opts = document.getElementById('options_table');
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    beanBag: document.body.classList.contains('mc-bean-bag-pdp'),
    swatchCount: document.querySelectorAll('img[src*="swatches/"]').length,
    swatches: sw,
    selectedCoverText: (document.body.innerText.match(/Selected cover:[\\s\\S]{0,120}/) || [])[0],
    optionsTableHtml: opts ? opts.innerHTML.slice(0, 1500) : null,
    descSwatchArea: (() => {
      const d = document.getElementById('ProductDetail_ProductDetails_div2') || document.querySelector('.colors_descriptionbox');
      if (!d) return null;
      return d.innerHTML.slice(0, 2500);
    })(),
    onclickSwatch: [...document.querySelectorAll('[onclick*="swatch"], a[href*="swatch"], .vCSS_img_line_group_features img')].slice(0,5).map(el => ({
      tag: el.tagName, onclick: el.getAttribute('onclick'), href: el.getAttribute('href')
    }))
  };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1200})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(8000)
    data = pg.evaluate(JS)
    print(json.dumps(data, indent=2)[:8000])
    # try click first swatch
    try:
        pg.click('img[src*="swatches/corduroy"]', timeout=5000)
        pg.wait_for_timeout(1500)
        after = pg.evaluate("""() => ({
          photo: document.getElementById('product_photo') && document.getElementById('product_photo').src,
          selected: (document.body.innerText.match(/Selected cover:[\\s\\S]{0,120}/) || [])[0],
          optionSelect: [...document.querySelectorAll('#options_table select option:checked')].map(o => o.textContent)
        })""")
        print('AFTER CLICK:', json.dumps(after, indent=2))
    except Exception as e:
        print('CLICK ERR:', e)
    b.close()
