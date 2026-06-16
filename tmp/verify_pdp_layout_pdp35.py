"""Verify PDP layout: mount flag, column order, no flicker, black ATC."""
from __future__ import annotations

import json
import sys
import time

from playwright.sync_api import sync_playwright

PAGES = [
    (
        "palliser",
        "https://www.mccabestheaterandliving.com/Palliser-Asher-Power-Reclining-Sofa-p/asher%2041065.htm",
    ),
    (
        "bean-bag",
        "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
    ),
]

ORDER_JS = """
() => {
  const col = document.querySelector('#v65-product-parent td.mc-pdp-options-td')
    || document.querySelector('#mc-pdp-title-right')?.closest('td');
  const media = col?.previousElementSibling;
  const ids = [
    'mc-pdp-title-right', 'mc-pdp-brand-logo', 'mc-pdp-price-stack-host',
    'messaging-element', 'mc-pdp-option-block', 'beanbag-swatch-wrapper',
    'mc-configured-color-swatch-wrapper', 'mc-pdp-description-below-features',
    'mc-pdp-features', 'mc-pdp-purchase-stack'
  ];
  const tops = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && col && col.contains(el)) tops[id] = Math.round(el.getBoundingClientRect().top);
  }
  const titleInMedia = media && media.querySelector('#mc-pdp-title-right, h1[itemprop=name]');
  const atc = document.querySelector('input[name=btnaddtocart], button[name=btnaddtocart]');
  let atcBg = null;
  if (atc) atcBg = getComputedStyle(atc).backgroundColor;
  const logo = document.querySelector('#mc-pdp-brand-logo img');
  const qty = document.querySelector('#mc-pdp-qty-row input, #mc-pdp-purchase-stack input[name^=QTY]');
  const atcInStack = atc && document.getElementById('mc-pdp-purchase-stack')?.contains(atc);
  const qtyLeftOfAtc = qty && atc && qty.getBoundingClientRect().right <= atc.getBoundingClientRect().left + 4;
  const ordered = Object.entries(tops).sort((a,b) => a[1]-b[1]).map(x => x[0]);
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || null,
    mounted: document.body?.dataset?.mcPdpLayoutMounted || null,
    titleInMedia: !!titleInMedia,
    brandLogo: !!logo,
    orderedInCol: ordered,
    atcBg,
    atcInStack,
    qtyLeftOfAtc,
    priceTop0: tops['mc-pdp-price-stack-host'] || null,
    featuresTop: tops['mc-pdp-features'] || null,
    purchaseTop: tops['mc-pdp-purchase-stack'] || null,
  };
}
"""

FLICKER_JS = """
(ids) => {
  const read = () => ids.map(id => {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.top), Math.round(r.left), el.parentNode?.id || el.parentNode?.className?.slice?.(0,40)];
  });
  return read();
}
"""


def verify_page(name: str, url: str) -> dict:
    out: dict = {"name": name, "url": url, "ok": True, "issues": []}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 1100})
        page.goto(url, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(8000)
        snap = page.evaluate(ORDER_JS)
        out["layout"] = snap

        if snap.get("ver") != "20260616pdp35b":
            out["issues"].append(f"version={snap.get('ver')} (expected 20260616pdp35b)")
        if snap.get("mounted") != "1":
            out["issues"].append(f"mcPdpLayoutMounted={snap.get('mounted')}")
        if snap.get("titleInMedia"):
            out["issues"].append("product title is in media column")
        if name == "palliser" and not snap.get("brandLogo"):
            out["issues"].append("Palliser brand logo missing")

        ordered = snap.get("orderedInCol") or []
        if "mc-pdp-features" in ordered and "mc-pdp-purchase-stack" in ordered:
            if ordered.index("mc-pdp-purchase-stack") < ordered.index("mc-pdp-features"):
                out["issues"].append("purchase stack above features")
        if "mc-pdp-description-below-features" in ordered and "mc-pdp-features" in ordered:
            if ordered.index("mc-pdp-features") < ordered.index("mc-pdp-description-below-features"):
                out["issues"].append("features above description")

        atc_bg = snap.get("atcBg") or ""
        if "rgb(17, 17, 17)" not in atc_bg and "#111" not in atc_bg:
            out["issues"].append(f"ATC not black: {atc_bg}")
        if not snap.get("qtyLeftOfAtc"):
            out["issues"].append("qty not immediately left of ATC")

        # 15s flicker watch on price + features positions
        ids = ["mc-pdp-price-stack-host", "mc-pdp-features"]
        baseline = page.evaluate(FLICKER_JS, ids)
        moves = 0
        for _ in range(15):
            time.sleep(1)
            cur = page.evaluate(FLICKER_JS, ids)
            if cur != baseline:
                moves += 1
                baseline = cur
        out["flickerMovesIn15s"] = moves
        if moves > 0:
            out["issues"].append(f"price/features moved {moves} times in 15s")

        page.screenshot(path=f"tmp/verify-{name}-pdp35.png", full_page=False)
        browser.close()

    out["ok"] = len(out["issues"]) == 0
    return out


def main() -> int:
    results = [verify_page(n, u) for n, u in PAGES]
    print(json.dumps(results, indent=2))
    return 0 if all(r["ok"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
