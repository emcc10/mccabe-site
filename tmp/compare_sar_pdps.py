from playwright.sync_api import sync_playwright
import json

pages = [
    ("ruched", "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"),
    ("chnk", "https://www.mccabestheaterandliving.com/product-p/sar-chnk-knt-lg.htm"),
    ("lush", "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, url in pages:
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(url, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(12000)
        data = page.evaluate(
            """() => ({
          pc: document.querySelector('input[name=ProductCode]')?.value,
          swatches: document.querySelectorAll('.mc-configured-color-swatch').length,
          visibleSwatches: [...document.querySelectorAll('.mc-configured-color-swatch')].filter(b => b.offsetParent !== null).length,
          label: document.querySelector('.mc-configured-color-swatch-label')?.textContent,
          optLabel: document.querySelector('#options_table tr')?.textContent?.replace(/\\s+/g,' ').trim().slice(0,60),
          gap: (() => { const m=document.querySelector('td.mc-pdp-media-td'); const o=document.querySelector('td.mc-pdp-options-td'); return m&&o?o.getBoundingClientRect().left-m.getBoundingClientRect().right:null; })(),
          mainRow: !!document.querySelector('tr.mc-pdp-main-row'),
          order: [...(document.querySelector('td.mc-pdp-options-td')?.children||[])].map(e=>e.id||e.tagName).slice(0,12)
        })"""
        )
        print(name, json.dumps(data))
    browser.close()
