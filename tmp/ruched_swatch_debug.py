from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(15000)
    info = page.evaluate(
        """() => {
      const wrap = document.getElementById('mc-configured-color-swatch-wrapper');
      const btns = wrap ? [...wrap.querySelectorAll('.mc-configured-color-swatch')] : [];
      return {
        wrap: !!wrap,
        html: wrap?.outerHTML?.slice(0,500),
        btns: btns.map(b => ({display: getComputedStyle(b).display, img: b.querySelector('img')?.src, complete: b.querySelector('img')?.complete, natural: b.querySelector('img')?.naturalWidth}))
      };
    }"""
    )
    print(info)
