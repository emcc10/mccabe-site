"""Re-fetch TMH mat photos at full Shopify resolution for both -1.jpg and -2T.jpg.

Volusion PDPs use {ProductCode}-2T.jpg as #product_photo, so the thumbnail must be full size.
"""
from __future__ import annotations

import io
import json
import re
import shutil
import urllib.parse
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site")
DEST = ROOT / "vspfiles" / "photos"
TMP = ROOT / "tmp" / "mat-refresh"

# Volusion title (normalized) -> ProductCode
TITLE_TO_CODE: dict[str, str] = {
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
}


def norm_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip().lower())


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_shopify_products() -> dict[str, dict]:
    urls = [
        "https://themahjonghousewholesale.com/collections/mats/products.json?limit=250",
        "https://themahjonghousewholesale.com/products.json?limit=250",
    ]
    by_title: dict[str, dict] = {}
    for url in urls:
        data = fetch_json(url)
        for product in data.get("products", []):
            by_title[norm_title(product.get("title", ""))] = product
    return by_title


def pick_image_url(product: dict) -> str | None:
    images = product.get("images") or []
    if not images:
        return None
    max_area = max(
        (int(img.get("width") or 0)) * int(img.get("height") or 0) for img in images
    )
    if max_area <= 0:
        return images[0]["src"]

    candidates = [
        img
        for img in images
        if (int(img.get("width") or 0)) * int(img.get("height") or 0) >= max_area * 0.95
    ]

    handle_parts = [p for p in product.get("handle", "").split("-") if len(p) > 3]

    def score(img: dict) -> tuple[int, int]:
        src = (img.get("src") or "").lower()
        handle_hits = sum(1 for part in handle_parts if part in src)
        area = int(img.get("width") or 0) * int(img.get("height") or 0)
        return (handle_hits, area)

    best = max(candidates, key=score)
    return best["src"]


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def save_jpeg(data: bytes, dest: Path) -> tuple[int, int]:
    if Image is None:
        dest.write_bytes(data)
        return (-1, -1)
    with Image.open(io.BytesIO(data)) as im:
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.save(dest, "JPEG", quality=93, optimize=True)
        return im.size


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)

    shopify = load_shopify_products()
    code_to_title = {code: title for title, code in TITLE_TO_CODE.items()}
    local_codes = sorted({p.name[:-6] for p in DEST.glob("TMH-MAT-*-1.jpg")})

    refreshed = []
    copied_local = []
    missing_shopify = []

    for code in local_codes:
        title_key = code_to_title.get(code)
        product = shopify.get(title_key) if title_key else None
        main_dest = DEST / f"{code}-1.jpg"
        thumb_dest = DEST / f"{code}-2T.jpg"

        if product:
            url = pick_image_url(product)
            if not url:
                missing_shopify.append(f"{code} (no images)")
                continue
            print(f"Refreshing {code} from Shopify ({url.split('/')[-1][:48]})...")
            data = download(url)
            size = save_jpeg(data, main_dest)
            shutil.copy2(main_dest, thumb_dest)
            refreshed.append((code, size))
            continue

        if main_dest.exists():
            print(f"Copying existing main image for {code} (no Shopify match)...")
            shutil.copy2(main_dest, thumb_dest)
            copied_local.append(code)
            continue

        missing_shopify.append(code)

    print(f"\nRefreshed from Shopify: {len(refreshed)}")
    for code, size in refreshed:
        print(f"  {code}: {size[0]}x{size[1]}")

    if copied_local:
        print(f"\nUpgraded -2T from existing -1 (no Shopify title): {len(copied_local)}")
        for code in copied_local:
            print(f"  {code}")

    if missing_shopify:
        print("\nMissing:")
        for item in missing_shopify:
            print(f"  - {item}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
