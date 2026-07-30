#!/usr/bin/env python3
"""Deploy only the Facebook checkout / White Glove assets to Volusion."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from verify_template_sftp import connect_paramiko_transport, template_remote_paths, write_remote_template


ROOT = Path(__file__).resolve().parents[1]
ASSETS = (
    "vspfiles/js/mc-delivery-zones.js",
    "vspfiles/js/mc-shipping-rate-policy.js",
    "vspfiles/js/mc-facebook-checkout.js",
    "vspfiles/css/mc-facebook-checkout.css",
)


def put_asset(sftp, rel: str) -> None:
    local = ROOT / rel
    if not local.is_file():
        raise FileNotFoundError(local)
    sub = rel.split("vspfiles/", 1)[1]
    remote = f"/v/vspfiles/{sub}"
    want = local.stat().st_size
    with local.open("rb") as source, sftp.open(remote, "wb") as target:
        while chunk := source.read(16384):
            target.write(chunk)
    got = sftp.stat(remote).st_size
    if got != want:
        raise OSError(f"size mismatch for {remote}: {got} != {want}")
    print(f"::notice::WHITE_GLOVE_ASSET_OK {remote} {got} bytes", flush=True)


def main() -> int:
    os.chdir(ROOT)
    host = os.environ["FTP_SERVER"]
    user = os.environ["FTP_USERNAME"]
    password = os.environ["FTP_PASSWORD"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    transport = connect_paramiko_transport(host, port, user, password)
    try:
        import paramiko
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            template = (ROOT / "template_266.html").read_bytes()
            uploaded_template = False
            for remote in template_remote_paths():
                try:
                    write_remote_template(sftp, remote, template)
                    print(f"::notice::WHITE_GLOVE_TEMPLATE_OK {remote}", flush=True)
                    uploaded_template = True
                    break
                except OSError as exc:
                    print(f"::warning::WHITE_GLOVE_TEMPLATE_SKIP {remote}: {exc}", flush=True)
            if not uploaded_template:
                raise OSError("No Volusion template path accepted the update")
            for rel in ASSETS:
                put_asset(sftp, rel)
        finally:
            sftp.close()
    finally:
        transport.close()
    print("::notice::WHITE_GLOVE_DEPLOY_VERIFIED", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
