#!/usr/bin/env python3
"""Audit TMH photo status: local repo vs live CDN."""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
CDN = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos"


def probe(url: str) -> int:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return int(resp.status)
    except Exception:
        return 0


def main() -> int:
    codes: set[str] = set()
    for path in PHOTOS.glob("TMH-*-1.jpg"):
        codes.add(path.name[:-6])

    rows = []
    for code in sorted(codes):
        local_main = PHOTOS / f"{code}-1.jpg"
        local_2t = PHOTOS / f"{code}-2T.jpg"
        cdn_code = probe(f"{CDN}/{code}-1.jpg")
        rows.append(
            {
                "code": code,
                "local_1": local_main.is_file(),
                "local_2t": local_2t.is_file(),
                "local_1_bytes": local_main.stat().st_size if local_main.is_file() else 0,
                "cdn_1_http": cdn_code,
                "needs_upload": local_main.is_file() and cdn_code != 200,
            }
        )

    missing_cdn = [r for r in rows if r["needs_upload"]]
    no_local = [r for r in rows if not r["local_1"]]

    out = ROOT / "tmp" / "tmh-photo-audit.json"
    out.write_text(
        json.dumps(
            {
                "total_codes": len(rows),
                "on_cdn": sum(1 for r in rows if r["cdn_1_http"] == 200),
                "local_only_needs_upload": len(missing_cdn),
                "missing_local": no_local,
                "rows": rows,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"TMH products in repo: {len(rows)}")
    print(f"On live CDN: {sum(1 for r in rows if r['cdn_1_http'] == 200)}")
    print(f"Local but NOT on CDN (need SFTP): {len(missing_cdn)}")
    print(f"Missing local files: {len(no_local)}")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
