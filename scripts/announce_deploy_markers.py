#!/usr/bin/env python3
"""Print GitHub Actions ::notice with deploy tokens from repo files (avoids broken bash quoting)."""
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

    cm = re.search(r"C_CSS_DEPLOY_VERIFY_([A-Za-z0-9]+)", css)
    css_tok = cm.group(1) if cm else "UNKNOWN"
    om = re.search(r"MC_OVERRIDES_VERIFY_([A-Za-z0-9]+)", (root / "vspfiles/templates/266/css/mccabe-overrides.css").read_text(encoding="utf-8", errors="replace"))
    overrides_tok = om.group(1) if om else "UNKNOWN"

    print(
        f"::notice::Deploy from Git: mc-deploy-verify={meta}; "
        f"custom-safe C_CSS_DEPLOY_VERIFY_{css_tok}; "
        f"mccabe-overrides MC_OVERRIDES_VERIFY_{overrides_tok} — confirm on live after SFTP",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
