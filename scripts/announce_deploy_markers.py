#!/usr/bin/env python3
"""Print GitHub Actions ::notice with mc-deploy-verify + CSS header token (no drift vs hardcoded strings)."""
from __future__ import annotations

import pathlib
import re
import sys


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    html = (root / "template_266.html").read_text(encoding="utf-8", errors="replace")
    css = (root / "vspfiles" / "css" / "custom-safe.css").read_text(encoding="utf-8", errors="replace")

    mm = re.search(r'name="mc-deploy-verify"\s+content="([^"]+)"', html)
    meta = mm.group(1) if mm else "UNKNOWN"

    cm = re.search(r"MC_DEPLOY_VERIFY_([A-Za-z0-9]+)", css)
    css_tok = cm.group(1) if cm else "UNKNOWN"

    print(
        f"::notice::Deploy from Git: mc-deploy-verify={meta}; "
        f"custom-safe.css MC_DEPLOY_VERIFY_{css_tok} — confirm both on live after run",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
