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
    return "20260617"


def dtk_plp_version(body: str) -> int:
    m = re.search(r"MC_DTK_PLP_([0-9]+)", body)
    return int(m.group(1)) if m else 0


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

    asset_checks = [
        (f"{SITE}/v/vspfiles/js/mc-plp-enforcer.js?v={ver}", f"MC_PLP_ENFORCER_{ver}"),
        (f"{SITE}/v/vspfiles/css/mc-plp-body-last.css?v={ver}", "mc-plp-image-box"),
    ]
    for url, needle in asset_checks:
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

    want_dtk = int(ver)
    dtk_urls = [
        (f"{SITE}/v/vspfiles/templates/266/js/min/design-toolkit.min.js", False),
        (
            f"{SITE}/v/vspfiles/templates/266/js/min/design-toolkit.min.js?v=20260520plp",
            True,
        ),
    ]
    for url, baked_query in dtk_urls:
        try:
            body = fetch(url).decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            print(f"::error::FETCH_FAIL {url}: {exc}", file=sys.stderr)
            fails += 1
            continue
        got_dtk = dtk_plp_version(body)
        if got_dtk >= want_dtk:
            print(f"::notice::OK MC_DTK_PLP_{got_dtk} @ {url}")
        elif baked_query and got_dtk > 0 and got_dtk < want_dtk:
            print(
                f"::warning::STALE_DTK {url} has MC_DTK_PLP_{got_dtk}, want >={want_dtk} — "
                "Cloudflare Purge by URL (category HTML loads ?v=20260520plp until template rebake)",
                file=sys.stderr,
            )
        elif got_dtk >= want_dtk - 1:
            print(
                f"::warning::DTK_LAG {url} has MC_DTK_PLP_{got_dtk}, want >={want_dtk} "
                "(CDN may lag SFTP; purge design-toolkit.min.js if PLP thumbs stay on 20260603)",
                file=sys.stderr,
            )
        else:
            print(
                f"::error::MISSING MC_DTK_PLP_{want_dtk} in {url} (got {got_dtk or 'none'})",
                file=sys.stderr,
            )
            fails += 1

    for cat in args.category:
        url = SITE + cat
        try:
            html = fetch(url).decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            print(f"::error::CATEGORY_FAIL {url}: {exc}", file=sys.stderr)
            fails += 1
            continue
        tags = re.findall(r"mc-plp-enforcer\.js\?v=([0-9]+)", html)
        tag_max = max((int(t) for t in tags), default=0)
        want_tag = int(ver)
        if "mc-plp-image-box" not in html:
            print(f"::error::{cat} missing mc-plp-image-box in baked HTML", file=sys.stderr)
            fails += 1
        elif tag_max < want_tag:
            print(
                f"::warning::{cat} baked enforcer tag max={tag_max} want >={want_tag} "
                "(Volusion File Editor → template_266 → Save to rebake /category-s/*.htm)",
                file=sys.stderr,
            )
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
        else:
            if abs(got - want) > 64:
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
