from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(14000)
    data = page.evaluate(
        """() => {
      const col = document.querySelector('td.mc-pdp-options-td');
      const kids = [...(col?.children || [])].map(el => ({
        id: el.id,
        cls: el.className,
        text: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80)
      }));
      const features = document.getElementById('mc-pdp-features');
      const wrap = document.getElementById('mc-configured-color-swatch-wrapper');
      const optBlock = document.getElementById('mc-pdp-option-block');
      const row = document.querySelector('tr.mc-pdp-main-row');
      const parent = row?.parentElement;
      return {
        kids,
        featuresExists: !!features,
        featuresParent: features?.parentElement?.id,
        featuresDisplay: features ? getComputedStyle(features).display : null,
        wrapInner: wrap?.innerHTML?.slice(0,300),
        optBlockVisible: optBlock ? getComputedStyle(optBlock).display : null,
        chooseColorRows: [...document.querySelectorAll('#options_table tr')].map(tr => tr.textContent.replace(/\\s+/g,' ').trim().slice(0,100)),
        rowDisplay: row ? getComputedStyle(row).display : null,
        tableLayout: parent?.tagName,
        viewport: {w: innerWidth, h: innerHeight}
      };
    }"""
    )
    print(json.dumps(data, indent=2))
