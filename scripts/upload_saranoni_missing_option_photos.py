#!/usr/bin/env python3
"""Upload specific Saranoni OptionID T/S images that are missing on live CDN."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
sys.path.insert(0, str(ROOT / "scripts"))

# Known missing live OptionID images.
# HP nursery size options need -T/-S so size chips can show product photos.
TARGETS = [
    # Lovey full-size OptionID images (swatch swap target) — live under photos/options/
    "options/SAR-BMBU-RYN-MSLN-XL-LG-4-1001.jpg",
    "options/SAR-BMBU-RYN-MSLN-XL-LG-4-1002.jpg",
    "options/SAR-BMBU-RYN-MSLN-XL-LG-4-1003.jpg",
    "options/SAR-BMBU-RYN-MSLN-XL-LG-4-1004.jpg",
    "options/SAR-BMBU-RYN-MSLN-XL-LG-4-1005.jpg",
    "options/SAR-BMBU-RYN-MSLN-XL-LG-4-1006.jpg",
    "options/SAR-CHNK-KNT-LG-1011.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1013.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1014.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1015.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1016.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1017.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1018.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1019.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1020.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1021.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1022.jpg",
    "options/SAR-DBL-RCH-FX-FUR-1023.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1013.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1014.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1015.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1016.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1017.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1018.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1019.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1020.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1021.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1022.jpg",
    "options/SAR-DBL-RCH-FX-FUR-XL-LG-1023.jpg",
    "options/SAR-MNKY-PLAY-MAT-1012.jpg",
    "options/SAR-MNKY-PLAY-MAT-1060.jpg",
    "options/SAR-STUFFED-ANML-LVYS-1206.jpg",
    "options/SAR-STUFFED-ANML-LVYS-1207.jpg",
    "options/SAR-STUFFED-ANML-LVYS-1208.jpg",
    "options/SAR-STUFFED-ANML-LVYS-1209.jpg",
    # HP Muslin Nursery — colors + size variants
    "SAR-HP-HP-MSLN-NRS-1359-T.jpg",
    "SAR-HP-HP-MSLN-NRS-1359-S.jpg",
    "SAR-HP-HP-MSLN-NRS-1360-T.jpg",
    "SAR-HP-HP-MSLN-NRS-1360-S.jpg",
    "SAR-HP-HP-MSLN-NRS-1361-T.jpg",
    "SAR-HP-HP-MSLN-NRS-1361-S.jpg",
    "SAR-HP-HP-MSLN-NRS-1362-T.jpg",
    "SAR-HP-HP-MSLN-NRS-1362-S.jpg",
    "SAR-HP-HP-MSLN-NRS-1363-T.jpg",
    "SAR-HP-HP-MSLN-NRS-1363-S.jpg",
    "SAR-HP-HP-MSLN-NRS-1364-T.jpg",
    "SAR-HP-HP-MSLN-NRS-1364-S.jpg",
    "SAR-HP-HP-MSLN-NRS-1365-T.jpg",
    "SAR-HP-HP-MSLN-NRS-1365-S.jpg",
    "SAR-HP-HP-MSLN-NRS-1366-T.jpg",
    "SAR-HP-HP-MSLN-NRS-1366-S.jpg",
    "SAR-COZY-BMB-ROBES-1341-T.jpg",  # Tori Halford (color)
    "SAR-COZY-BMB-ROBES-1341-S.jpg",
    "SAR-BAMBONI-SETS-1444-T.jpg",  # Charcoal (color)
    "SAR-BAMBONI-SETS-1444-S.jpg",
    "SAR-BAMBONI-SETS-1117-T.jpg",  # Taupe (color)
    "SAR-BAMBONI-SETS-1117-S.jpg",
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
    "SAR-STUFFED-ANML-ROCKERS-Puppy-T.jpg",
    "SAR-STUFFED-ANML-ROCKERS-Puppy-S.jpg",
    "SAR-STUFFED-ANML-ROCKERS-Bear-T.jpg",
    "SAR-STUFFED-ANML-ROCKERS-Bear-S.jpg",
    "SAR-STUFFED-ANML-ROCKERS-Elephant-T.jpg",
    "SAR-STUFFED-ANML-ROCKERS-Elephant-S.jpg",
]

# The script will also upload any files that match the missing audit report
import json
AUDIT_PATH = ROOT / "tmp" / "missing_variant_images_audit.json"

def get_audit_targets():
    if not AUDIT_PATH.is_file():
        return []
    try:
        with open(AUDIT_PATH, "r") as f:
            report = json.load(f)
            return [e["target_name"] for e in report]
    except:
        return []

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
    
    # Automatically include all SAR- images found in vspfiles/photos
    for p in PHOTOS.glob("SAR-*.jpg"):
        if p.name not in files:
            files.append(p.name)
    
    # Also include any HP nursery altviews 9-24 present locally
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
