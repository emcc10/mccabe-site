#!/usr/bin/env python3
"""Purge Cloudflare cache for sticky Volusion asset URLs (optional).

Requires GitHub secrets / env:
  CLOUDFLARE_API_TOKEN  — API token with Zone.Cache Purge
  CLOUDFLARE_ZONE_ID    — zone id for mccabestheaterandliving.com

Exits 0 when secrets are missing (prints purge URLs) or purge succeeds.
Exits 1 only when secrets are present and the API call fails.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

STORE = "https://www.mccabestheaterandliving.com"

# Baked HTML still references these query strings; CF caches them for 1 year.
DEFAULT_URLS = [
    f"{STORE}/v/vspfiles/js/mc-plp-enforcer.js",
    f"{STORE}/v/vspfiles/js/mc-plp-enforcer.js?v=20260725fix3",
    f"{STORE}/v/vspfiles/js/mc-plp-enforcer.js?v=20260726001home1",
    f"{STORE}/v/vspfiles/js/mc-plp-enforcer.js?v=20260726001home1&mcrd=safe1",
    f"{STORE}/v/vspfiles/js/mc-plp-enforcer.js?v=20260727001fix1",
    f"{STORE}/v/vspfiles/js/mc-plp-enforcer.js?v=20260727002pdp1",
    f"{STORE}/v/vspfiles/js/mc-plp-enforcer.js?v=20260727002pdp1&mcrd=pdp1",
    f"{STORE}/v/vspfiles/js/mc-pdp-auth-cta-form.js?v=20260725gat2",
    f"{STORE}/v/vspfiles/js/mc-pdp-auth-cta-form.js?v=20260725sofa1&mcrd=sofa1",
    f"{STORE}/v/vspfiles/js/mc-pdp-alt-view-row.js?v=20260725gat2",
    f"{STORE}/v/vspfiles/js/mc-pdp-alt-view-row.js?v=20260725altmatch1",
    f"{STORE}/v/vspfiles/css/custom-safe.css",
]


def main() -> int:
    token = (os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    zone = (os.environ.get("CLOUDFLARE_ZONE_ID") or "").strip()
    urls = list(DEFAULT_URLS)
    extra = (os.environ.get("CLOUDFLARE_PURGE_URLS") or "").strip()
    if extra:
        urls.extend([u.strip() for u in extra.split(",") if u.strip()])

    print("=== Cloudflare purge targets ===", flush=True)
    for u in urls:
        print(f"  {u}", flush=True)

    if not token or not zone:
        print(
            "::warning::CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID not set — "
            "purge manually in Cloudflare → Caching → Custom Purge for the URLs above "
            "(especially mc-plp-enforcer.js?v=20260725fix3). "
            "Also Volusion Design → File Editor → template_266.html → Save to rebake pages.",
            flush=True,
        )
        return 0

    body = json.dumps({"files": urls}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")
        print(f"::error::Cloudflare purge HTTP {exc.code}: {err}", flush=True)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"::error::Cloudflare purge failed: {exc}", flush=True)
        return 1

    if not data.get("success"):
        print(f"::error::Cloudflare purge unsuccessful: {data}", flush=True)
        return 1

    print("::notice::Cloudflare purge OK for storefront enforcer/CSS URLs", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
