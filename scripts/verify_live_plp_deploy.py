#!/usr/bin/env python3
"""Fail CI if live storefront is not serving the expected PLP deploy."""
from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0 (McCabe deploy verify)"}
ROOT = Path(__file__).resolve().parents[1]


def fetch(url: str, *, binary: bool = False) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def expected_version() -> str:
    enforcer = ROOT / "vspfiles" / "js" / "mc-plp-enforcer.js"
    if enforcer.is_file():
        m = re.search(r'VERSION = "([0-9]+)"', enforcer.read_text(encoding="utf-8"))
        if m:
            return m.group(1)
    return "20260616"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default=expected_version())
    parser.add_argument(
        "--category",
        action="append",
        default=["/category-s/177.htm", "/category-s/187.htm"],
    )
    args = parser.parse_args()
    ver = args.version
    fails = 0

    checks = [
        (f"{SITE}/v/vspfiles/js/mc-plp-enforcer.js?v={ver}", f"MC_PLP_ENFORCER_{ver}"),
        (f"{SITE}/v/vspfiles/templates/266/js/min/design-toolkit.min.js", f"MC_DTK_PLP_{ver}"),
        (f"{SITE}/v/vspfiles/css/mc-plp-body-last.css?v={ver}", "mc-plp-image-box"),
    ]
    for url, needle in checks:
        try:
            body = fetch(url).decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            print(f"::error::FETCH_FAIL {url}: {exc}", file=sys.stderr)
            fails += 1
            continue
        if needle not in body:
            print(f"::error::MISSING {needle!r} in {url}", file=sys.stderr)
            fails += 1
        else:
            print(f"::notice::OK {needle} @ {url}")

    for cat in args.category:
        url = SITE + cat
        try:
            html = fetch(url).decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            print(f"::error::CATEGORY_FAIL {url}: {exc}", file=sys.stderr)
            fails += 1
            continue
        tags = re.findall(r"mc-plp-enforcer\.js\?v=([0-9]+)", html)
        if not tags or max(int(t) for t in tags) < int(ver):
            print(
                f"::error::{cat} enforcer tag max={tags!r} want >={ver}",
                file=sys.stderr,
            )
            fails += 1
        elif "mc-plp-image-box" not in html:
            print(f"::error::{cat} missing mc-plp-image-box in baked HTML", file=sys.stderr)
            fails += 1
        else:
            print(f"::notice::OK {cat} enforcer={tags[0]} has mc-plp-image-box")

    sample = ROOT / "vspfiles" / "photos" / "77170-01-1.jpg"
    if sample.is_file():
        want = sample.stat().st_size
        try:
            got = len(fetch(f"{SITE}/v/vspfiles/photos/77170-01-1.jpg?mcv={ver}"))
        except urllib.error.HTTPError as exc:
            print(f"::error::PHOTO_FAIL 77170-01-1.jpg: HTTP {exc.code}", file=sys.stderr)
            fails += 1
        elif abs(got - want) > 64:
            print(
                f"::warning::PHOTO_SIZE 77170-01-1.jpg local={want} cdn={got} "
                "(purge CDN if gray mat persists)",
                file=sys.stderr,
            )
        else:
            print(f"::notice::OK photo 77170-01-1.jpg bytes={got}")

    if fails:
        print(
            "::error::Live PLP verify failed. If SFTP is OK, open Volusion "
            "Design → File Editor → template_266.html → Save once to rebake categories.",
            file=sys.stderr,
        )
        return 1
    print("::notice::LIVE_PLP_VERIFY_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
