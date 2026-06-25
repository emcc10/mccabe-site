#!/usr/bin/env python3
"""Check live URLs the storefront actually loads (no ?cache-bust).

Cache-busted fetches can show FIXED while the real page URL is still broken.
"""
from __future__ import annotations

import sys
import urllib.error
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
CDN = "https://cdn4.volusion.store/srulk-fqudj"
UA = {"User-Agent": "McCabe live-restore verify"}


def fetch(url: str) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, resp.read()


def main() -> int:
    fails = 0

    url = f"{SITE}/v/vspfiles/templates/266/js/min/template.min.js"
    try:
        status, body = fetch(url)
        corrupt = b"a.topSpacing=0};q=q" in body
        want = 287_496
        ok = status == 200 and len(body) == want and not corrupt
        label = "FIXED" if ok else "BROKEN"
        print(f"template.min.js (no cache bust): {label} status={status} len={len(body)} want={want}")
        if not ok:
            fails += 1
    except Exception as exc:  # noqa: BLE001
        print(f"template.min.js: FETCH_FAIL {exc}")
        fails += 1

    for name, want in (
        ("SAR-MNKY-LUSH-1.jpg", 353_284),
        ("SAR-GRAND-FX-FUR-12X20-1.jpg", 168_132),
    ):
        for base in (f"{SITE}/v/vspfiles/photos", f"{CDN}/v/vspfiles/photos"):
            url = f"{base}/{name}"
            try:
                status, body = fetch(url)
                size_ok = want is None or len(body) == want
                ok = status == 200 and len(body) > 0 and size_ok
                print(
                    f"{name} @ {base.split('//', 1)[-1]}: "
                    f"{'OK' if ok else 'FAIL'} status={status} len={len(body)}"
                )
                if not ok:
                    fails += 1
            except urllib.error.HTTPError as exc:
                print(f"{name} @ {base.split('//', 1)[-1]}: FAIL status={exc.code}")
                fails += 1
            except Exception as exc:  # noqa: BLE001
                print(f"{name} @ {base.split('//', 1)[-1]}: FETCH_FAIL {exc}")
                fails += 1

    if fails:
        print(f"\n{fails} check(s) failed — re-upload to /v/vspfiles/... (see PLP-FIX-INSTRUCTIONS.txt)")
        return 1
    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
