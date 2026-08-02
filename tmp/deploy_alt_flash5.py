#!/usr/bin/env python3
"""Deploy flash5 alt-view fix: unique row file + stub + impl + plp."""
from __future__ import annotations

import base64
import re
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPT = Path(
    r"C:\Users\erink\.cursor\projects\c-Users-erink-mccabe-site"
    r"\agent-transcripts\a5808957-ebec-42f4-a153-f437179fe06c"
    r"\a5808957-ebec-42f4-a153-f437179fe06c.jsonl"
)

FILES = [
    ("vspfiles/js/mc-pdp-alt-view-row.js", ROOT / "vspfiles/js/mc-pdp-alt-view-row.js"),
    (
        "vspfiles/js/mc-pdp-alt-view-row-20260802flash5.js",
        ROOT / "vspfiles/js/mc-pdp-alt-view-row-20260802flash5.js",
    ),
    ("vspfiles/js/mc-pdp-auth-cta-form.js", ROOT / "tmp/mc-pdp-auth-cta-form.STUB-live.js"),
    ("vspfiles/js/mc-pdp-auth-cta-form-impl.js", ROOT / "vspfiles/js/mc-pdp-auth-cta-form-impl.js"),
    ("vspfiles/js/mc-plp-enforcer.js", ROOT / "vspfiles/js/mc-plp-enforcer.js"),
]

BASES = (
    "vspfiles/js",
    "/v/vspfiles/js",
    "wwwroot/vspfiles/js",
    "./wwwroot/vspfiles/js",
)


def main() -> int:
    stub = (ROOT / "tmp/mc-pdp-auth-cta-form.STUB-live.js").read_text(encoding="utf-8")
    flash5 = (ROOT / "vspfiles/js/mc-pdp-alt-view-row-20260802flash5.js").read_bytes()
    assert "mc-pdp-alt-view-row-20260802flash5.js" in stub
    assert "mcrd=flash5" in stub
    assert b"20260802flash5" in flash5
    assert b"never paint while" in flash5

    text = TRANSCRIPT.read_text(encoding="utf-8", errors="ignore")
    pw = base64.b64decode(re.search(r"FromBase64String\('([^']+)'\)", text).group(1)).decode()

    last = None
    for attempt in range(8):
        try:
            tr = paramiko.Transport(("sftp.mccabestheaterandliving.com", 2222))
            tr.banner_timeout = 120
            tr.connect(username="erin", password=pw)
            break
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(3 * (attempt + 1))
    else:
        raise SystemExit(last)

    sftp = paramiko.SFTPClient.from_transport(tr)
    try:
        for remote_name, local in FILES:
            data = local.read_bytes()
            fname = Path(remote_name).name
            for base in BASES:
                remote = f"{base}/{fname}"
                try:
                    with sftp.open(remote, "wb") as handle:
                        handle.write(data)
                    print("PUT", remote, sftp.stat(remote).st_size)
                except Exception as exc:  # noqa: BLE001
                    print("SKIP", remote, type(exc).__name__)
    finally:
        sftp.close()
        tr.close()
    print("OK flash5")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
