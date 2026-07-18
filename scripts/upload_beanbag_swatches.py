#!/usr/bin/env python3
"""Upload bean bag cover swatches under vspfiles/swatches/corduroy/ to Volusion SFTP."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SWATCH_DIR = ROOT / "vspfiles" / "swatches" / "corduroy"
sys.path.insert(0, str(ROOT / "scripts"))

# Exact live PDP filenames (case matters on Volusion).
TARGETS = [
    "ch-navy.jpg",
    "chenille-charcoal.jpg",
    "chenille-espresso.jpg",
    "chenille-moss.jpg",
    "chenille-rainforest.jpg",
    "chenille-tan.jpg",
    "chenille-veriperi.jpg",
    "cloud-cumulus.jpg",
    "cloud-earth.jpg",
    "cloud-stormy.jpg",
    "fauxfur-black.jpg",
    "fauxfur-cowprint.jpg",
    "fauxfur-gray.jpg",
    "fauxfur-navy.jpg",
    "fauxfur-pink.jpg",
    "fauxfur-tan.jpg",
    "fauxfur-white.jpg",
    "fauxLeather-black.jpg",
    "fauxLeather-coffee.jpg",
    "fauxLeather-cognac.jpg",
    "fauxLeather-ivory.jpg",
]


def _swatch_remotes(name: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for p in (
        f"/v/vspfiles/swatches/corduroy/{name}",
        f"/vspfiles/swatches/corduroy/{name}",
        f"/mccabestheaterandliving.com/v/vspfiles/swatches/corduroy/{name}",
        f"vspfiles/swatches/corduroy/{name}",
    ):
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    from deploy_volusion_assets import _upload_one
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    files = [n for n in TARGETS if (SWATCH_DIR / n).is_file()]
    # Also upload any extra corduroy JPGs present locally (e.g. terry/nest backups).
    for p in sorted(SWATCH_DIR.glob("*.jpg")):
        if p.name not in files:
            files.append(p.name)

    if not files:
        print("No bean bag swatch files found", file=sys.stderr)
        return 1

    print(f"Uploading {len(files)} bean bag swatch(es)...")
    transport = connect_paramiko_transport(
        os.environ["FTP_SERVER"],
        int(os.environ.get("SFTP_PORT", "2222")),
        os.environ["FTP_USERNAME"],
        os.environ["FTP_PASSWORD"],
    )
    ok = fail = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for i, name in enumerate(files, 1):
                local = str(SWATCH_DIR / name)
                size = os.path.getsize(local)
                if _upload_one(sftp, local, _swatch_remotes(name)):
                    print(f"[{i}/{len(files)}] OK {name} ({size} bytes)", flush=True)
                    ok += 1
                else:
                    print(f"[{i}/{len(files)}] FAIL {name}", file=sys.stderr, flush=True)
                    fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()

    print(f"Uploaded {ok}/{len(files)} bean bag swatch(es); failed {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
