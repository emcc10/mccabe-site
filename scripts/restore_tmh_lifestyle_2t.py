#!/usr/bin/env python3
"""Restore TMH lifestyle heroes onto -2T.jpg (PDP #product_photo).

Do NOT overwrite -1.jpg (packshot / white-bg catalog image).
Prefer Shopify secondary images, then live -2.jpg / altviews that are not white-bg.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
TMP = ROOT / "tmp" / "tmh-lifestyle-restore"
MANIFEST = ROOT / "tmp" / "tmh-lifestyle-restore-manifest.json"
MIN_WIDTH = 650
MAIN_MAX = 2400
LIVE = "https://www.mccabestheaterandliving.com/v/vspfiles/photos"
SHOPIFY = "https://themahjonghousewholesale.com"
UA = {"User-Agent": "Mozilla/5.0"}

# Normalized Shopify title -> Volusion code (mats + accessories + known extras)
TITLE_TO_CODE: dict[str, str] = {
    # mats (from tmp/refresh_mat_photos.py)
    "amethyst gem double-sided mahjong mat": "TMH-MAT-AMETHYST-GEM-MAT",
    "amethyst gem double-sided travel mahjong mat": "TMH-MAT-AMETHYST-GEM-TRAVEL-MAT",
    "amethyst table double-sided mahjong mat": "TMH-MAT-AMETHYST-TABLE-MAT",
    "amethyst table double-sided travel mahjong mat": "TMH-MAT-AMETHYST-TABLE-TRAVEL-MAT",
    "blue & pink flower border mahjong mat": "TMH-MAT-BLU-PNK-FLWR-BDR",
    "blue double-sided mahjong mat": "TMH-MAT-BLUE-MAT",
    "blue island border mahjong mat": "TMH-MAT-BLUE-ISLAND-BORDER-MAT",
    "blue peony mahjong mat": "TMH-MAT-BLUE-PEONY-MAT",
    "coral peony mahjong mat": "TMH-MAT-CORAL-PEONY-MAT",
    "deco circle double-sided mahjong mat": "TMH-MAT-DECO-CIRCLE-MAT",
    "deco deep & gold double-sided mahjong mat": "TMH-MAT-DECO-DEEP-AND-GOLD-MAT",
    "deco olive & red double-sided mahjong mat": "TMH-MAT-DECO-OLIVE-AND-RED-MAT",
    "electric blue garden double-sided mahjong mat": "TMH-MAT-ELEC-BLU-GARDEN",
    "electric blue trellis double-sided mahjong mat": "TMH-MAT-ELEC-BLU-TRELLIS",
    "emerald gem double-sided mahjong mat": "TMH-MAT-EMERALD-GEM-MAT",
    "emerald table double-sided mahjong mat": "TMH-MAT-EMERALD-TABLE-MAT",
    "green flower border mahjong mat": "TMH-MAT-GRN-FLWR-BDR",
    "hot pink island border mahjong mat": "TMH-MAT-HOT-PNK-ISLAND",
    "lilac garden double-sided mahjong mat": "TMH-MAT-LILAC-GARDEN-MAT",
    "lilac trellis double-sided mahjong mat": "TMH-MAT-LILAC-TRELLIS-MAT",
    "mod bird bam & plaid double-sided mahjong mat": "TMH-MAT-MOD-BIRD-PLAID",
    "mod joker & plaid double-sided mahjong mat": "TMH-MAT-MOD-JOKER-PLAID",
    "mod stripes double-sided mahjong mat": "TMH-MAT-MOD-STRIPES-MAT",
    "pink corner stars mahjong mat": "TMH-MAT-PINK-CORNER-STARS-MAT",
    "pink double-sided mahjong mat": "TMH-MAT-PINK-MAT",
    "pink island border mahjong mat": "TMH-MAT-PINK-ISLAND-BORDER-MAT",
    "plum garden double-sided mahjong mat": "TMH-MAT-PLUM-GARDEN-MAT",
    "plum trellis double-sided mahjong mat": "TMH-MAT-PLUM-TRELLIS-MAT",
    "ruby gem double-sided mahjong mat": "TMH-MAT-RUBY-GEM-MAT",
    "ruby table double-sided mahjong mat": "TMH-MAT-RUBY-TABLE-MAT",
    "sapphire gem double-sided mahjong mat": "TMH-MAT-SAPPHIRE-GEM-MAT",
    "sapphire table double-sided mahjong mat": "TMH-MAT-SAPPHIRE-TABLE-MAT",
    "teal garden double-sided mahjong mat": "TMH-MAT-TEAL-GARDEN-MAT",
    "teal trellis double-sided mahjong mat": "TMH-MAT-TEAL-TRELLIS-MAT",
    "turquoise flower mahjong mat": "TMH-MAT-TURQUOISE-FLOWER-MAT",
    "yellow island border mahjong mat": "TMH-MAT-YELLOW-ISLAND",
    # accessories
    "rattan tile box": "TMH-ACC-RATTAN-TILE-BOX",
    "purple & tan raffia mahjong bag": "TMH-ACC-PURP-TAN-RAFFIA",
    "white & tan raffia mahjong bag": "TMH-ACC-WHT-TAN-RAFFIA",
    "canvas carry-all tote, pink": "TMH-ACC-CARRYALL-PINK",
    "canvas carry-all tote, red": "TMH-ACC-CARRYALL-RED",
    "canvas zipper rectangular tile bag": "TMH-ACC-ZIP-RECT-TILE-BAG",
    "canvas zipper square tile bag": "TMH-ACC-ZIP-SQ-TILE-BAG",
    "large seagrass tote": "TMH-ACC-LG-SEAGRASS-TOTE",
    "house raffia charm": "TMH-ACC-HOUSE-RAFFIA-CHARM",
    # racks
    "set of 4 dusty blue mahjong racks": "TMH-RACK-DUSTY-BLUE-RACKS",
    "set of 4 tortoise mahjong racks": "TMH-RACK-TORTOISE-RACKS",
    "set of 4 white mother of pearl mahjong racks": "TMH-RACK-WHT-MOP",
    "set of 4 black mother of pearl mahjong racks": "TMH-RACK-BLK-MOP",
    "set of 4 clear mahjong racks": "TMH-RACK-CLEAR-RACKS",
    "set of 4 navy mahjong racks": "TMH-RACK-NAVY-RACKS",
    "set of 4 green mahjong racks": "TMH-RACK-GREEN-RACKS",
    # tiles
    "tortoise & cream mod tiles": "TMH-TILE-TORTOISE-CREAM",
}

# Travel mat codes that alias from MAT photo stems (sync_tmh_trv_mat_photos)
TRV_FROM_MAT = {
    "TMH-TRV-AMETHYST-GEM-MAT": "TMH-MAT-AMETHYST-GEM-TRAVEL-MAT",
    "TMH-TRV-AMETHYST-TABLE-MAT": "TMH-MAT-AMETHYST-TABLE-TRAVEL-MAT",
    "TMH-TRV-BLUE-MAT": "TMH-MAT-BLUE-MAT",
    "TMH-TRV-ELEC-BLU-GARDEN": "TMH-MAT-ELEC-BLU-GARDEN",
    "TMH-TRV-ELEC-BLU-TRELLIS": "TMH-MAT-ELEC-BLU-TRELLIS",
    "TMH-TRV-EMERALD-GEM-MAT": "TMH-MAT-EMERALD-GEM-MAT",
    "TMH-TRV-EMERALD-TABLE-MAT": "TMH-MAT-EMERALD-TABLE-MAT",
    "TMH-TRV-LILAC-GARDEN-MAT": "TMH-MAT-LILAC-GARDEN-MAT",
    "TMH-TRV-LILAC-TRELLIS-MAT": "TMH-MAT-LILAC-TRELLIS-MAT",
    "TMH-TRV-PLUM-GARDEN-MAT": "TMH-MAT-PLUM-GARDEN-MAT",
    "TMH-TRV-PLUM-TRELLIS-MAT": "TMH-MAT-PLUM-TRELLIS-MAT",
    "TMH-TRV-PURP-RED-GRN": "TMH-MAT-DECO-OLIVE-AND-RED-MAT",
    "TMH-TRV-RUBY-GEM-MAT": "TMH-MAT-RUBY-GEM-MAT",
    "TMH-TRV-RUBY-TABLE-MAT": "TMH-MAT-RUBY-TABLE-MAT",
    "TMH-TRV-SAPPHIRE-GEM-MAT": "TMH-MAT-SAPPHIRE-GEM-MAT",
    "TMH-TRV-SAPPHIRE-TABLE-MAT": "TMH-MAT-SAPPHIRE-TABLE-MAT",
    "TMH-TRV-TEAL-GARDEN-MAT": "TMH-MAT-TEAL-GARDEN-MAT",
    "TMH-TRV-TEAL-TRELLIS-MAT": "TMH-MAT-TEAL-TRELLIS-MAT",
}


def norm_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip().lower())


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def fetch_json(url: str) -> dict:
    return json.loads(fetch_bytes(url).decode("utf-8", "replace"))


def white_score(im: Image.Image) -> int:
    rgb = im.convert("RGB")
    w, h = rgb.size
    pts = [
        (5, 5),
        (w - 6, 5),
        (5, h - 6),
        (w - 6, h - 6),
        (w // 2, 5),
        (w // 2, h - 6),
        (5, h // 2),
        (w - 6, h // 2),
    ]
    near = 0
    for x, y in pts:
        r, g, b = rgb.getpixel((x, y))
        if r > 235 and g > 235 and b > 235:
            near += 1
    return near


def lifestyle_name_bonus(src: str) -> int:
    s = src.lower()
    bonus = 0
    if "productphotography" in s or "product-photography" in s:
        bonus += 8
    if "lifestyle" in s or "scene" in s or "styled" in s:
        bonus += 6
    if re.search(r"_\d+\.jpg", s) and "tile" not in s:
        bonus += 1
    # packshot-ish filenames
    if any(x in s for x in ("flat", "packshot", "whitebg", "onwhite")):
        bonus -= 4
    return bonus


def save_jpeg(data: bytes, dest: Path) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as im:
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        w, h = im.size
        if w < MIN_WIDTH:
            raise ValueError(f"width {w} < {MIN_WIDTH}")
        if max(w, h) > MAIN_MAX:
            im.thumbnail((MAIN_MAX, MAIN_MAX), Image.Resampling.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "JPEG", quality=92, optimize=True)
        return im.size


def load_shopify() -> dict[str, dict]:
    paths = [
        "/products.json?limit=250",
        "/collections/mats/products.json?limit=250",
        "/collections/travel-mahjong/products.json?limit=250",
        "/collections/accessories/products.json?limit=250",
        "/collections/mahjong-tiles/products.json?limit=250",
        "/collections/racks/products.json?limit=250",
    ]
    by_title: dict[str, dict] = {}
    for path in paths:
        try:
            data = fetch_json(SHOPIFY + path)
        except Exception as exc:
            print(f"WARN shopify {path}: {exc}")
            continue
        for product in data.get("products") or []:
            by_title[norm_title(product.get("title", ""))] = product
    return by_title


def pick_lifestyle_from_shopify(product: dict) -> tuple[str | None, str]:
    images = product.get("images") or []
    if len(images) < 2:
        if not images:
            return None, "no-images"
        # single image — only use if filename suggests lifestyle photography
        src = images[0].get("src") or ""
        if lifestyle_name_bonus(src) >= 6:
            return src, "shopify-single-lifestyle-name"
        return None, "shopify-single-skip"

    scored: list[tuple[int, int, str]] = []
    for idx, img in enumerate(images):
        src = img.get("src") or ""
        w = int(img.get("width") or 0)
        h = int(img.get("height") or 0)
        if w and w < MIN_WIDTH:
            continue
        # prefer later images + lifestyle filename; deprioritize first packshot
        score = lifestyle_name_bonus(src) + (0 if idx == 0 else 3) + min(w, 2000) // 400
        scored.append((score, w * h, src))
    if not scored:
        return None, "shopify-all-small"
    scored.sort(reverse=True)
    best_score, _, best_src = scored[0]
    # If best is image[0] and score is weak, try second
    if best_src == images[0].get("src") and best_score < 5 and len(scored) > 1:
        best_src = scored[1][2]
        return best_src, "shopify-second"
    return best_src, f"shopify-score-{best_score}"


def try_live_candidates(code: str, pack_md5: str) -> tuple[bytes | None, str]:
    """Prefer live -2 / altviews that differ from packshot and are less white."""
    pack_path = PHOTOS / f"{code}-1.jpg"
    pack_white = 8
    if pack_path.is_file():
        with Image.open(pack_path) as im:
            pack_white = white_score(im)

    best: tuple[int, bytes, str] | None = None
    for suf in ("-2.jpg", "-altview1.jpg", "-altview2.jpg", "-altview3.jpg"):
        url = f"{LIVE}/{code}{suf}"
        try:
            data = fetch_bytes(url)
        except Exception:
            continue
        if hashlib.md5(data).hexdigest() == pack_md5:
            continue
        try:
            with Image.open(io.BytesIO(data)) as im:
                w, h = im.size
                if w < MIN_WIDTH:
                    continue
                ws = white_score(im)
        except Exception:
            continue
        # lifestyle should be less white than packshot, or clearly different scene
        if ws >= pack_white and ws >= 6:
            continue
        score = (8 - ws) * 10 + w
        if best is None or score > best[0]:
            best = (score, data, f"live{suf}")
    if best:
        return best[1], best[2]
    return None, "no-live-lifestyle"


def local_codes() -> list[str]:
    return sorted({p.name[:-6] for p in PHOTOS.glob("TMH-*-1.jpg")})


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    shopify = load_shopify()
    print(f"Shopify products loaded: {len(shopify)}")

    # Invert title map; also add travel titles that match mat codes later via TRV_FROM_MAT
    code_to_product: dict[str, dict] = {}
    for title, code in TITLE_TO_CODE.items():
        if title in shopify:
            code_to_product[code] = shopify[title]

    # Fuzzy: any shopify title containing key tokens for unmatched codes is hard;
    # instead match remaining by scanning all shopify titles against code fragments.
    unmatched_titles = []
    for title, product in shopify.items():
        if title in TITLE_TO_CODE:
            continue
        unmatched_titles.append((title, product))

    rows = []
    restored = 0
    skipped = 0
    failed = 0

    for code in local_codes():
        pack = PHOTOS / f"{code}-1.jpg"
        dest = PHOTOS / f"{code}-2T.jpg"
        pack_md5 = hashlib.md5(pack.read_bytes()).hexdigest() if pack.is_file() else ""

        source_url = None
        reason = ""
        data = None

        # 1) Shopify lifestyle for mapped code
        product = code_to_product.get(code)
        if product is None and code in TRV_FROM_MAT:
            # travel alias: use mat product lifestyle if mapped
            mat_code = TRV_FROM_MAT[code]
            product = code_to_product.get(mat_code)

        if product is not None:
            source_url, reason = pick_lifestyle_from_shopify(product)
            if source_url:
                try:
                    data = fetch_bytes(source_url)
                except Exception as exc:
                    data = None
                    reason = f"shopify-download-fail:{exc}"

        # 2) Live -2 / altview lifestyle fallback
        if data is None:
            data, reason = try_live_candidates(code, pack_md5)

        if data is None:
            skipped += 1
            rows.append({"code": code, "status": "skip", "reason": reason})
            print(f"SKIP {code}: {reason}")
            continue

        # Reject if identical to packshot
        if hashlib.md5(data).hexdigest() == pack_md5:
            skipped += 1
            rows.append({"code": code, "status": "skip", "reason": "same-as-packshot"})
            print(f"SKIP {code}: same as -1")
            continue

        try:
            with Image.open(io.BytesIO(data)) as im:
                ls_white = white_score(im)
            pack_white = 8
            if pack.is_file():
                with Image.open(pack) as im:
                    pack_white = white_score(im)
            # If candidate is MORE white-bg than packshot, don't use it as lifestyle
            if ls_white > pack_white and ls_white >= 6:
                skipped += 1
                rows.append(
                    {
                        "code": code,
                        "status": "skip",
                        "reason": f"candidate-whiter:{ls_white}>{pack_white}",
                    }
                )
                print(f"SKIP {code}: candidate whiter than packshot")
                continue

            size = save_jpeg(data, dest)
        except Exception as exc:
            failed += 1
            rows.append({"code": code, "status": "fail", "reason": str(exc)})
            print(f"FAIL {code}: {exc}")
            continue

        restored += 1
        rows.append(
            {
                "code": code,
                "status": "restored",
                "reason": reason,
                "source": source_url,
                "size": list(size),
                "white": ls_white,
                "pack_white": pack_white,
            }
        )
        print(f"OK {code} <- {reason} {size[0]}x{size[1]} white={ls_white}")

    # Sync TRV aliases from MAT when MAT was restored and TRV still identical to pack
    for trv, mat in TRV_FROM_MAT.items():
        mat_2t = PHOTOS / f"{mat}-2T.jpg"
        trv_1 = PHOTOS / f"{trv}-1.jpg"
        trv_2t = PHOTOS / f"{trv}-2T.jpg"
        if not mat_2t.is_file() or not trv_1.is_file():
            continue
        if hashlib.md5(mat_2t.read_bytes()).hexdigest() == hashlib.md5(
            (PHOTOS / f"{mat}-1.jpg").read_bytes()
        ).hexdigest():
            continue
        # copy lifestyle onto TRV-2T if TRV-2T still equals TRV-1
        if trv_2t.is_file() and hashlib.md5(trv_2t.read_bytes()).hexdigest() == hashlib.md5(
            trv_1.read_bytes()
        ).hexdigest():
            trv_2t.write_bytes(mat_2t.read_bytes())
            restored += 1
            rows.append(
                {
                    "code": trv,
                    "status": "restored",
                    "reason": f"alias-from-{mat}",
                    "size": list(Image.open(trv_2t).size),
                }
            )
            print(f"OK {trv} <- alias {mat}-2T")

    MANIFEST.write_text(json.dumps({"restored": restored, "skipped": skipped, "failed": failed, "rows": rows}, indent=2), encoding="utf-8")
    print(f"\nRestored {restored}; skipped {skipped}; failed {failed}")
    print(f"Wrote {MANIFEST}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
