from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width": 1280, "height": 900})
    page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", wait_until="load", timeout=90000)
    page.wait_for_timeout(12000)
    data = page.evaluate("""() => {
      const thumbs = [...document.querySelectorAll('a[href*="BB-FAUX-FUR"], img[src*="BB-FAUX-FUR"]')].map(el => ({
        tag: el.tagName,
        href: el.href || el.getAttribute('href') || '',
        src: el.src || el.getAttribute('src') || '',
        onclick: el.getAttribute('onclick') || '',
        title: el.title || el.getAttribute('title') || '',
        alt: el.alt || el.getAttribute('alt') || '',
        parentOnclick: el.parentElement ? (el.parentElement.getAttribute('onclick') || '') : ''
      }));
      const swatches = [...document.querySelectorAll('.beanbag-swatch')].map(s => ({
        option: s.getAttribute('data-option'),
        alt: s.alt,
        src: (s.src || '').split('/').pop()
      }));
      return { thumbs: thumbs.slice(0, 20), swatches };
    }""")
    print(json.dumps(data, indent=2))
