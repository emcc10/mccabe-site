#!/usr/bin/env python3
"""Pull the four critical live site files into the local repo."""
from __future__ import annotations

import hashlib
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UA = {"User-Agent": "Mozilla/5.0 (McCabe live sync)"}

FILES = [
    (
        "https://www.mccabestheaterandliving.com/v/template_266.html",
        ROOT / "template_266.html",
    ),
    (
        "https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css",
        ROOT / "vspfiles" / "css" / "custom-safe.css",
    ),
    (
        "https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-pdp-auth-cta-fix.js",
        ROOT / "vspfiles" / "js" / "mc-pdp-auth-cta-fix.js",
    ),
    (
        "https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-plp-enforcer.js",
        ROOT / "vspfiles" / "js" / "mc-plp-enforcer.js",
    ),
]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url + "?v=live-sync", headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def main() -> None:
    for url, dest in FILES:
        live = fetch(url)
        old = dest.read_bytes() if dest.is_file() else b""
        print(f"{dest.relative_to(ROOT)}")
        print(
            f"  live={len(live)} repo_before={len(old)} "
            f"identical={live == old} "
            f"md5_live={hashlib.md5(live).hexdigest()[:12]}"
        )
        if len(live) < 1000:
            raise SystemExit(f"refusing to write suspiciously small file: {dest}")
        dest.write_bytes(live)
        print(f"  wrote {dest}")


if __name__ == "__main__":
    main()
