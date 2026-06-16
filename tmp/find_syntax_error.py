from playwright.sync_api import sync_playwright
import json, re

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto("https://www.mccabestheaterandliving.com/default.asp", wait_until="domcontentloaded", timeout=120000)
    page.wait_for_timeout(3000)
    scripts = page.evaluate("""() => {
      return [...document.querySelectorAll('script:not([src])')].map((s, i) => ({
        i,
        len: (s.textContent||'').length,
        preview: (s.textContent||'').slice(0,80).replace(/\\s+/g,' ')
      }));
    }""")
    browser.close()

print(json.dumps({"pageerrors": errors, "inline_scripts": len(scripts)}, indent=2))
