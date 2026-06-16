from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("console", lambda msg: errors.append({"type": msg.type, "text": msg.text}) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append({"type": "pageerror", "text": str(exc)}))
    page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", wait_until="domcontentloaded", timeout=120000)
    page.wait_for_timeout(8000)
    data = page.evaluate("""() => {
      const ot = document.getElementById('options_table');
      const body = document.body.className;
      const scripts = [...document.querySelectorAll('script[src*="mc-pdp-auth-cta-fix"]')].map(s => s.src);
      const sizeLabel = document.getElementById('mc-bb-size-label');
      const selects = [...document.querySelectorAll('#options_table select, #v65-product-parent select')].map(s => ({
        name: s.name,
        visible: !!(s.offsetWidth || s.offsetHeight),
        display: getComputedStyle(s).display,
        opts: [...s.options].map(o => ({v: o.value, t: o.text.trim()}))
      }));
      const planner = {
        embed: !!document.getElementById('roomPlannerEmbed'),
        app: !!document.getElementById('roomPlannerApp'),
        initFn: typeof window.initRoomPlanner,
        injectInSource: document.documentElement.innerHTML.indexOf('injectRoomPlanner') !== -1
      };
      const marker = document.querySelector('meta[name="mc-live-deploy-check"]')?.content || null;
      return {
        bodyClass: body,
        scripts,
        ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
        optionsTable: ot ? { display: getComputedStyle(ot).display, position: getComputedStyle(ot).position, left: getComputedStyle(ot).left, className: ot.className, htmlLen: ot.innerHTML.length } : null,
        selects,
        sizeLabel: sizeLabel ? sizeLabel.textContent : null,
        swatches: document.querySelectorAll('.beanbag-swatch').length,
        planner,
        marker,
        deployVerify: document.querySelector('meta[name="mc-deploy-verify"]')?.content || null
      };
    }""")
    print(json.dumps({"data": data, "console_errors": errors}, indent=2))
    browser.close()
