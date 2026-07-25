#!/usr/bin/env python3
"""Remove cross-family Steve Silver altviews and renumber survivors.

Steve Silver PDP galleries often include related-product images (Keily on a
Conroe page, Noah on Denver, etc.). Those were scraped into
`{CODE}-altviewN.jpg` and surface on the storefront. This script:

1. Reads tmp/altview-inventory/altview_download_report.csv
2. Flags altviews whose source filename belongs to a different product family
3. Deletes the bad local files
4. Renumbers remaining altviews to a dense 1..N sequence
5. Appends remote leftovers to vspfiles/photos/.altview-remote-deletes.txt
"""
from __future__ import annotations

import csv
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
REPORT = ROOT / "tmp" / "altview-inventory" / "altview_download_report.csv"
DELETE_LIST = PHOTOS / ".altview-remote-deletes.txt"
KEEP_MAP = ROOT / "tmp" / "altview-inventory" / "ss_altview_keep_slots.json"
REUPLOAD_MARKER = PHOTOS / ".ss-altview-cleanup"

FAMILY_ALIASES: dict[str, list[str]] = {
    "CONROE": ["conroe"],
    "DENVER": ["denver"],
    "GATLIN": ["gatlin"],
    "KEILY": ["keily", "kiely"],
    "LUNA": ["luna"],
    "OLSEN": ["olsen"],
    "NOAH": ["noah"],
    "PROVO": ["provo"],
    "LEXINGTON": ["lexington"],
    "LEHI": ["lehi"],
    "BRISBANE": ["brisbane"],
    "CASSIE": ["cassie", "cas900"],
    "BEARCREEK": ["bearcreek", "bear_creek", "bc900", "bc950"],
    "HIGHLANDPARK": ["highlandpark", "highland_park", "hp900"],
    "RIVERDALE": ["riverdale", "rv900"],
    "MONTANA": ["montana", "mon900"],
    "WILSHIRE": ["wilshire", "ws890", "ws89q0"],
    "SWANSON": ["swanson", "ss100"],
    "VENETO": ["veneto", "vn340"],
    "TYBEE": ["tybee"],
    "CANOVA": ["canova"],
    "HYLAND": ["hyland", "hy500"],
    "JOANNA": ["joanna", "ja500"],
    "AUBURN": ["auburn", "aub500"],
    "COLVIN": ["colvin", "col500"],
    "BURLINGTON": ["burlington", "bur500"],
}

PREFIX_FAMILY = {
    "BC": "BEARCREEK",
    "HP": "HIGHLANDPARK",
    "CAS": "CASSIE",
    "RV": "RIVERDALE",
    "MON": "MONTANA",
    "WS": "WILSHIRE",
    "HY": "HYLAND",
    "JA": "JOANNA",
    "AUB": "AUBURN",
    "COL": "COLVIN",
    "BUR": "BURLINGTON",
}

FOREIGN_TOKENS = [
    ("keily", "KEILY"),
    ("kiely", "KEILY"),
    ("lexington", "LEXINGTON"),
    ("provo", "PROVO"),
    ("noah", "NOAH"),
    ("olsen", "OLSEN"),
    ("lehi", "LEHI"),
    ("brisbane", "BRISBANE"),
    ("highlandpark", "HIGHLANDPARK"),
    ("highland_park", "HIGHLANDPARK"),
    ("hp900", "HIGHLANDPARK"),
    ("bearcreek", "BEARCREEK"),
    ("bear_creek", "BEARCREEK"),
    ("bc900", "BEARCREEK"),
    ("bc950", "BEARCREEK"),
    ("wilshire", "WILSHIRE"),
    ("ws890", "WILSHIRE"),
    ("ws89q0", "WILSHIRE"),
    ("swanson", "SWANSON"),
    ("ss100", "SWANSON"),
    ("veneto", "VENETO"),
    ("riverdale", "RIVERDALE"),
    ("montana", "MONTANA"),
    ("cassie", "CASSIE"),
    ("denver", "DENVER"),
    ("gatlin", "GATLIN"),
    ("conroe", "CONROE"),
    ("luna", "LUNA"),
    ("tybee", "TYBEE"),
    ("canova", "CANOVA"),
]


def code_family(code: str) -> str | None:
    parts = code.split("-")
    if len(parts) < 2:
        return None
    p1 = parts[1]
    m = re.match(r"^([A-Z]+)(\d+)", p1)
    if m:
        return PREFIX_FAMILY.get(m.group(1), p1)
    return p1


def is_foreign(code: str, source_url: str) -> bool:
    """True when the source URL is clearly not this product family.

    Prefer positive family/SKU match. Local -2.jpg copies and empty URLs are
    treated as unknown (not foreign) so we don't delete unscored keepers.
    """
    fam = code_family(code)
    if not fam:
        return False
    fname = (source_url or "").rsplit("/", 1)[-1].lower()
    if not fname or fname.startswith("http") or "vspfiles/photos" in fname:
        return False
    aliases = FAMILY_ALIASES.get(fam, [fam.lower()])
    if any(a in fname for a in aliases):
        return False
    code_frags = [p for p in code.replace("SS-", "").lower().split("-") if len(p) >= 4]
    if any(p in fname for p in code_frags):
        return False
    foreign = {name for token, name in FOREIGN_TOKENS if token in fname and name != fam}
    # Named foreign family, or any other stevesilver product filename that
    # doesn't mention us (Brock/Ottawa/etc. not in the token list).
    if foreign:
        return True
    # Heuristic: Manufacturer filenames usually start with a collection name.
    # If it looks like Product_SKU_... and isn't ours, drop it.
    if re.match(r"^[a-z]+[_-]", fname) and not any(a in fname for a in aliases):
        return True
    return False


def load_existing_deletes() -> list[str]:
    if not DELETE_LIST.is_file():
        return []
    out: list[str] = []
    for line in DELETE_LIST.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if not name or name.startswith("#"):
            continue
        out.append(name)
    return out


def alt_slot(path: Path) -> int | None:
    m = re.search(r"-altview(\d+)\.jpg$", path.name, re.I)
    return int(m.group(1)) if m else None


def main() -> int:
    if not REPORT.is_file():
        print(f"Missing report: {REPORT}", file=sys.stderr)
        return 2

    url_by_code_alt: dict[tuple[str, int], str] = {}
    codes_in_report: set[str] = set()
    for row in csv.DictReader(REPORT.open(encoding="utf-8-sig")):
        if row.get("Brand") != "SS" or row.get("Status") != "OK":
            continue
        code = (row.get("ProductCode") or "").strip().upper()
        alt = (row.get("AltIndex") or "").strip()
        if not code or not alt.isdigit():
            continue
        codes_in_report.add(code)
        url_by_code_alt[(code, int(alt))] = row.get("SourceURL") or ""

    remote_deletes: set[str] = set(load_existing_deletes())
    keep_slots: dict[str, list[int]] = {}
    deleted_local = 0
    renumbered = 0
    touched_codes = 0

    for code in sorted(codes_in_report):
        disk_files = sorted(
            (p for p in PHOTOS.glob(f"{code}-altview*.jpg") if p.is_file()),
            key=lambda p: alt_slot(p) or 0,
        )
        if not disk_files:
            continue

        before_slots = {alt_slot(p) for p in disk_files if alt_slot(p)}
        keepers: list[Path] = []
        changed = False

        for path in disk_files:
            slot = alt_slot(path)
            if slot is None:
                continue
            url = url_by_code_alt.get((code, slot), "")
            if url and is_foreign(code, url):
                print(f"DELETE {path.name} <- {url.rsplit('/', 1)[-1]}")
                path.unlink()
                deleted_local += 1
                changed = True
            else:
                keepers.append(path)

        if not changed and [alt_slot(p) for p in keepers] == list(range(1, len(keepers) + 1)):
            keep_slots[code] = list(range(1, len(keepers) + 1))
            continue

        touched_codes += 1

        # Stage keepers to temps, then write dense 1..N.
        staged: list[Path] = []
        for i, path in enumerate(keepers, 1):
            tmp = PHOTOS / f".tmp-{code}-altview{i}.jpg"
            if tmp.exists():
                tmp.unlink()
            shutil.move(str(path), str(tmp))
            staged.append(tmp)

        final_slots: list[int] = []
        for i, tmp in enumerate(staged, 1):
            dest = PHOTOS / f"{code}-altview{i}.jpg"
            if dest.exists():
                dest.unlink()
            shutil.move(str(tmp), str(dest))
            renumbered += 1
            print(f"KEEP/RENUMBER -> {dest.name}")
            final_slots.append(i)

        # Only delete remote slots that no longer exist locally after renumber.
        # Reused slot numbers (e.g. bad altview2 replaced by former altview3)
        # must be uploaded, not deleted.
        after_slots = set(final_slots)
        for slot in sorted(before_slots - after_slots):
            remote_deletes.add(f"{code}-altview{slot}.jpg")
            print(f"REMOTE_DELETE {code}-altview{slot}.jpg")

        keep_slots[code] = final_slots

    prior_non_ss = [n for n in load_existing_deletes() if not n.upper().startswith("SS-")]
    all_deletes = sorted(set(prior_non_ss) | {n for n in remote_deletes if n})
    DELETE_LIST.write_text(
        "# Leftover mismatched / renumbered altviews — delete from Volusion SFTP.\n"
        + "\n".join(all_deletes)
        + "\n",
        encoding="utf-8",
    )
    KEEP_MAP.parent.mkdir(parents=True, exist_ok=True)
    KEEP_MAP.write_text(json.dumps(keep_slots, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    REUPLOAD_MARKER.write_text("ss-altview-family-cleanup\n", encoding="utf-8")
    # Do not touch .altview-reupload (that triggers a full *all* altview upload).

    print(
        f"\nDone. touched_codes={touched_codes} deleted_local={deleted_local} "
        f"renumber_ops={renumbered} remote_delete_names={len(all_deletes)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
