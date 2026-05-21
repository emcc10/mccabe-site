#!/usr/bin/env python3
"""HTTP gate: live /v/vspfiles/js/* byte size must match repo (browser-like fetch)."""
from __future__ import annotations

import os
import subprocess
import sys
import time

ORIGIN = "https://www.mccabestheaterandliving.com"
FILES = {
    "vspfiles/js/mc-pdp-auth-cta-fix.js": "/v/vspfiles/js/mc-pdp-auth-cta-fix.js",
    "vspfiles/js/mc-pdp-price-stack.js": "/v/vspfiles/js/mc-pdp-price-stack.js",
}
NEEDLE = "mcEnsurePdpPriceStack"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 McCabeDeployVerify/1.0"
)


def fetch_curl(url: str) -> bytes:
    proc = subprocess.run(
        [
            "curl",
            "-fsSL",
            "-A",
            UA,
            "-H",
            "Accept: */*",
            "-H",
            "Cache-Control: no-cache",
            url,
        ],
        capture_output=True,
        timeout=60,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or b"").decode("utf-8", errors="replace").strip()
        raise RuntimeError(err or f"curl exit {proc.returncode}")
    return proc.stdout or b""


def fetch_urllib(url: str) -> bytes:
    import urllib.request

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache, no-store",
            "Pragma": "no-cache",
            "Referer": ORIGIN + "/",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def fetch(url: str) -> bytes:
    try:
        return fetch_curl(url)
    except Exception as curl_exc:  # noqa: BLE001
        print(f"::notice::curl fetch failed ({curl_exc}); trying urllib", flush=True)
        return fetch_urllib(url)


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
            print(
                f"::error::HTTP stale/missing {path} — origin bytes do not match repo",
                file=sys.stderr,
            )
            all_ok = False

    if all_ok:
        print("::notice::MC_PDP_JS_HTTP_OK", flush=True)
        return 0
    print(
        "::error::HTTP verify failed — if SFTP gate passed, browsers may still need CDN purge",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
