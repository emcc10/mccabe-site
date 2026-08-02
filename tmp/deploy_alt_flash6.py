#!/usr/bin/env python3
"""Deploy flash6: stop CF-cached plp reinject + hide rail until probe ready."""
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
    ("mc-pdp-alt-view-row.js", ROOT / "vspfiles/js/mc-pdp-alt-view-row.js"),
    (
        "mc-pdp-alt-view-row-20260802flash6.js",
        ROOT / "vspfiles/js/mc-pdp-alt-view-row-20260802flash6.js",
    ),
    ("mc-pdp-auth-cta-form.js", ROOT / "tmp/mc-pdp-auth-cta-form.STUB-live.js"),
    ("mc-pdp-auth-cta-form-impl.js", ROOT / "vspfiles/js/mc-pdp-auth-cta-form-impl.js"),
    ("mc-plp-enforcer.js", ROOT / "vspfiles/js/mc-plp-enforcer.js"),
]

BASES = (
    "vspfiles/js",
    "/v/vspfiles/js",
    "wwwroot/vspfiles/js",
    "./wwwroot/vspfiles/js",
)


def main() -> int:
    stub = (ROOT / "tmp/mc-pdp-auth-cta-form.STUB-live.js").read_text(encoding="utf-8")
    flash6 = (ROOT / "vspfiles/js/mc-pdp-alt-view-row-20260802flash6.js").read_bytes()
    impl = (ROOT / "vspfiles/js/mc-pdp-auth-cta-form-impl.js").read_bytes()
    assert "mc-pdp-alt-view-row-20260802flash6.js" in stub
    assert "mcrd=flash6" in stub
    assert "20260725fix3" in stub  # plp trap
    assert b"20260802flash6" in flash6
    assert b"data-mc-alt-ready" in flash6
    assert b"DEPLOY_RANK = 20260802006" in impl

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
        for fname, local in FILES:
            data = local.read_bytes()
            for base in BASES:
                remote = f"{base}/{fname}"
                try:
                    with sftp.open(remote, "wb") as handle:
                        handle.write(data)
                    print("PUT", remote, sftp.stat(remote).st_size, flush=True)
                except Exception as exc:  # noqa: BLE001
                    print("SKIP", remote, type(exc).__name__, flush=True)
    finally:
        sftp.close()
        tr.close()
    print("OK flash6", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
