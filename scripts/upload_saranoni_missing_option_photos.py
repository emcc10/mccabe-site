#!/usr/bin/env python3
"""Upload specific Saranoni OptionID T/S images that are missing on live CDN."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
sys.path.insert(0, str(ROOT / "scripts"))

# Known missing live OptionID images (Grand Faux Fur text-only swatches, etc.)
TARGETS = [
    "SAR-GRAND-FX-FUR-1351-T.jpg",
    "SAR-GRAND-FX-FUR-1351-S.jpg",
    "SAR-GRAND-FX-FUR-1352-T.jpg",
    "SAR-GRAND-FX-FUR-1352-S.jpg",
    "SAR-GRAND-FX-FUR-1353-T.jpg",
    "SAR-GRAND-FX-FUR-1353-S.jpg",
    "SAR-GRAND-FX-FUR-XL-LG-1351-T.jpg",
    "SAR-GRAND-FX-FUR-XL-LG-1351-S.jpg",
    "SAR-GRAND-FX-FUR-XL-LG-1353-T.jpg",
    "SAR-GRAND-FX-FUR-XL-LG-1353-S.jpg",
]


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    from deploy_volusion_assets import _photo_remotes, _upload_one
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    files = [n for n in TARGETS if (PHOTOS / n).is_file()]
    # Also include any HP nursery altviews 9-24 present locally
    for i in range(1, 25):
        name = f"SAR-HP-HP-MSLN-NRS-altview{i}.jpg"
        if (PHOTOS / name).is_file() and name not in files:
            files.append(name)

    if not files:
        print("No target files found", file=sys.stderr)
        return 1

    print(f"Uploading {len(files)} targeted photo(s)...")
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
                local = str(PHOTOS / name)
                if _upload_one(sftp, local, _photo_remotes(name)):
                    print(f"[{i}/{len(files)}] OK {name}", flush=True)
                    ok += 1
                else:
                    print(f"[{i}/{len(files)}] FAIL {name}", file=sys.stderr, flush=True)
                    fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()

    print(f"Uploaded {ok}/{len(files)}; failed {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
