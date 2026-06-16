import json
from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(14000)
    data = page.evaluate(
        """() => {
      const sel = document.querySelector('select[name*="___23"]');
      const opts = sel ? [...sel.options].map(o => ({v:o.value, t:o.text})) : [];
      const wrap = document.getElementById('mc-configured-color-swatch-wrapper');
      const swatches = wrap ? [...wrap.querySelectorAll('.mc-configured-color-swatch')].map(b => ({
        display: getComputedStyle(b).display,
        img: b.querySelector('img')?.src,
        visible: b.offsetParent !== null
      })) : [];
      const label = document.querySelector('.mc-configured-color-swatch-label');
      const optBlock = document.getElementById('mc-pdp-option-block');
      const colKids = [...(document.querySelector('td.mc-pdp-options-td')?.children || [])].map(el => el.id || el.tagName);
      const row = document.querySelector('tr.mc-pdp-main-row');
      const media = document.querySelector('td.mc-pdp-media-td');
      const optTd = document.querySelector('td.mc-pdp-options-td');
      const gap = row ? getComputedStyle(row).gap : null;
      return {
        bodyClass: document.body.className,
        version: window.__MC_PDP_AUTH_CTA_FIX_VER__,
        opts,
        labelText: label?.textContent,
        swatchCount: swatches.length,
        swatches: swatches.slice(0, 8),
        optBlockHtml: optBlock?.innerHTML?.slice(0, 500),
        colKids,
        gap,
        mediaW: media?.getBoundingClientRect().width,
        optW: optTd?.getBoundingClientRect().width,
        mediaRight: media?.getBoundingClientRect().right,
        optLeft: optTd?.getBoundingClientRect().left,
        colGapPx: optTd && media ? optTd.getBoundingClientRect().left - media.getBoundingClientRect().right : null,
      };
    }"""
    )
    print(json.dumps(data, indent=2))
    # probe swatch image URLs
    if data.get("opts"):
        pc = "SAR-LUSH-MINI"
        for o in data["opts"]:
            if not o["v"]:
                continue
            url = f"https://www.mccabestheaterandliving.com/v/vspfiles/photos/{pc}-{o['v']}-S.jpg"
            resp = page.request.head(url)
            print(o["t"], o["v"], resp.status)
