#!/usr/bin/env python3
"""Deploy flash4 alt-view fix via uniquely named JS + cache-busted auth stub."""
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
ALT = ROOT / "vspfiles" / "js" / "mc-pdp-alt-view-row.js"
ALT_NAME = "mc-pdp-alt-view-row-20260802flash4.js"
IMPL = ROOT / "vspfiles" / "js" / "mc-pdp-auth-cta-form-impl.js"
STUB = ROOT / "tmp" / "mc-pdp-auth-cta-form.STUB-live.js"


def password() -> str:
    text = TRANSCRIPT.read_text(encoding="utf-8", errors="ignore")
    match = re.search(r"FromBase64String\('([^']+)'\)", text)
    return base64.b64decode(match.group(1)).decode("utf-8")


def connect():
    last = None
    for attempt in range(10):
        try:
            transport = paramiko.Transport(("sftp.mccabestheaterandliving.com", 2222))
            transport.banner_timeout = 120
            transport.connect(username="erin", password=password())
            return transport
        except Exception as exc:  # noqa: BLE001
            last = exc
            print("connect retry", attempt, type(exc).__name__, flush=True)
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"connect failed: {last}")


def main() -> int:
    alt = ALT.read_bytes()
    stub = STUB.read_bytes()
    impl = IMPL.read_bytes()
    assert b"flash4" in alt and b"transition:none" in alt
    assert b"is-active" in alt
    assert b"MC_ALT_VIEW_FLASH4_20260802" in stub
    assert b"20260802flash4" in stub
    assert b'ALT_VIEW_ROW_VER = "20260802flash4"' in impl
    assert b"DEPLOY_RANK = 20260802003" in impl

    transport = connect()
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        for base in (
            "vspfiles/js",
            "/v/vspfiles/js",
            "wwwroot/vspfiles/js",
            "./wwwroot/vspfiles/js",
        ):
            uploads = (
                (ALT, ALT_NAME),
                (ALT, "mc-pdp-alt-view-row.js"),
                (IMPL, "mc-pdp-auth-cta-form-impl.js"),
                (STUB, "mc-pdp-auth-cta-form.js"),
            )
            for local, name in uploads:
                remote = f"{base}/{name}"
                try:
                    if local == STUB:
                        with sftp.open(remote, "wb") as handle:
                            handle.write(stub)
                        print("PUT", remote, sftp.stat(remote).st_size, flush=True)
                    else:
                        sftp.put(str(local), remote, confirm=True)
                        print("PUT", remote, sftp.stat(remote).st_size, flush=True)
                except Exception as exc:  # noqa: BLE001
                    print("SKIP", remote, type(exc).__name__, flush=True)
    finally:
        sftp.close()
        transport.close()
    print("OK", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
