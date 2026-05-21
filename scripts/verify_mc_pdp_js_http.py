#!/usr/bin/env python3
"""HTTP gate: live /v/vspfiles/js/* byte size must match repo (what the browser fetches)."""
from __future__ import annotations

import os
import sys
import time
import urllib.request

ORIGIN = "https://www.mccabestheaterandliving.com"
FILES = {
    "vspfiles/js/mc-pdp-auth-cta-fix.js": "/v/vspfiles/js/mc-pdp-auth-cta-fix.js",
    "vspfiles/js/mc-pdp-price-stack.js": "/v/vspfiles/js/mc-pdp-price-stack.js",
}
NEEDLE = "mcEnsurePdpPriceStack"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read()


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))
    bust = int(time.time())
    all_ok = True

    for local, path in FILES.items():
        if not os.path.isfile(local):
            print(f"::error::Missing local {local}", file=sys.stderr)
            all_ok = False
            continue
        want_size = os.path.getsize(local)
        url = f"{ORIGIN}{path}?deploy_verify={bust}"
        try:
            body = fetch(url)
        except Exception as exc:  # noqa: BLE001
            print(f"::error::HTTP fetch failed {url}: {exc}", file=sys.stderr)
            all_ok = False
            continue
        got_size = len(body)
        needle_ok = NEEDLE.encode() in body
        ok = got_size == want_size and needle_ok
        print(
            f"::notice::HTTP {path} bytes={got_size} want={want_size} needle={'yes' if needle_ok else 'no'}",
            flush=True,
        )
        if ok:
            print(f"::notice::HTTP_OK {path}", flush=True)
        else:
            print(f"::error::HTTP stale/missing {path} — Volusion did not publish this file", file=sys.stderr)
            all_ok = False

    if all_ok:
        print("::notice::MC_PDP_JS_HTTP_OK", flush=True)
        return 0
    print("::error::HTTP verify failed — do not trust a green job without MC_PDP_JS_HTTP_OK", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
