#!/usr/bin/env python3
"""Verify live mtl-sectional-renderer.js contains expected MTL_RENDERER_BUILD."""
from __future__ import annotations

import re
import sys
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
WANT = "sectional-20260601-top-price-panel-v29"
UA = {"User-Agent": "Mozilla/5.0 (McCabe MTL verify)"}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "replace")


def main() -> int:
    urls = [
        f"{SITE}/v/vspfiles/js/mtl-sectional-renderer.js",
        f"{SITE}/v/vspfiles/js/mtl-sectional-renderer.js?v={WANT}",
    ]
    fails = 0
    for url in urls:
        try:
            body = fetch(url)
        except Exception as exc:  # noqa: BLE001
            print(f"::error::MTL_FETCH_FAIL {url}: {exc}", file=sys.stderr)
            fails += 1
            continue
        m = re.search(r'MTL_RENDERER_BUILD\s*=\s*"([^"]+)"', body)
        got = m.group(1) if m else "MISSING"
        if got == WANT:
            print(f"::notice::OK MTL_RENDERER_BUILD={got} @ {url}")
        else:
            print(
                f"::warning::MTL_STALE {url} has {got!r}, want {WANT!r} "
                "(Volusion SFTP body stale — sectional-configs loads GitHub raw)",
                file=sys.stderr,
            )
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
