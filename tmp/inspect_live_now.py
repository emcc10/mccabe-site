from playwright.sync_api import sync_playwright
import json

def inspect(url, label):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("console", lambda msg: errors.append({"type": msg.type, "text": msg.text}) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append({"type": "pageerror", "text": str(exc)}))
        page.goto(url, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(10000)
        data = page.evaluate("""() => {
          const html = document.documentElement.innerHTML;
          const ot = document.getElementById('options_table');
          const selects = [...document.querySelectorAll('#options_table select, #v65-product-parent select, select[name^="SELECT___"]')].map(s => ({
            name: s.name,
            id: s.id,
            display: getComputedStyle(s).display,
            opts: [...s.options].slice(0, 12).map(o => o.text.trim())
          }));
          return {
            marker: document.querySelector('meta[name="mc-live-deploy-check"]')?.content || null,
            deployVerify: document.querySelector('meta[name="mc-deploy-verify"]')?.content || null,
            bodyClass: document.body.className,
            srcHasEmbed: html.includes('roomPlannerEmbed'),
            srcHasInit: html.includes('window.initRoomPlanner'),
            srcHasCommon: html.includes('Common configurations'),
            srcHasAppVisible: !!document.getElementById('roomPlannerApp'),
            srcHasEmbedEl: !!document.getElementById('roomPlannerEmbed'),
            mcPlannerOverlay: !!document.getElementById('mcPlannerOverlay'),
            mcPlannerBtn: !!document.getElementById('mcPlannerBtn'),
            optionsTable: ot ? {
              display: getComputedStyle(ot).display,
              position: getComputedStyle(ot).position,
              left: getComputedStyle(ot).left,
              className: ot.className,
              parent: ot.parentElement?.id || ot.parentElement?.className || null
            } : null,
            selects,
            sizeLabel: document.getElementById('mc-bb-size-label')?.textContent || null,
            swatches: document.querySelectorAll('.beanbag-swatch').length,
            pdpVer: window.__MC_PDP_AUTH_CTA_FIX_VER__ || null,
            scripts: [...document.querySelectorAll('script[src*="mc-pdp-auth-cta-fix"]')].map(s => s.src)
          };
        }""")
        page_errors = [e for e in errors if e["type"] == "pageerror"]
        browser.close()
        return {"label": label, "url": url, "data": data, "pageerrors": page_errors, "console_errors": errors[:15]}

print(json.dumps([
  inspect("https://www.mccabestheaterandliving.com/default.asp", "home"),
  inspect("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", "beanbag"),
], indent=2))
