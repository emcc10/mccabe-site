#!/usr/bin/env python3
"""Enrich SAVED_EXPORT_DB3G94DK88.csv with vendor data, techspecs, categories, and photos."""
from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import urllib.error
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
DEFAULT_SRC = Path(r"c:\Users\erink\Downloads\SAVED_EXPORT_DB3G94DK88.csv")
DEFAULT_DEST = ROOT / "catalog" / "steve-silver-active" / "SAVED_EXPORT_DB3G94DK88_enriched.csv"
UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver bed catalog)"}
THUMB_MAX = (900, 700)
JPEG_QUALITY = 90
UPLOADS = "https://stevesilver.com/wp-content/uploads"

CAT_DINING_SET = "215"
CAT_DINING_CHAIR = "216"
CAT_DINING_SERVER = "217"

# Volusion export productname sometimes disagrees with vendor description text.
NAME_OVERRIDES: dict[str, str] = {
    "SS-2968479": "Gatlin Dual Power Recliner",
    "SS-3PC-LOVESE": "Stone Power Console Loveseat",
    "SS-GAT70696T": "Stone Dual Power Reclining Console Loveseat",
    "SS-GAT70696T-2": "Stone Dual Power Reclining Sofa",
    "SS-KE800CG": "Marlow Manual Swivel Glider Recliner",
}

# Steve Silver internal SKU prefix → collection name (HY500PT → Hyland, DAR500BPT → Darcy, …).
SKU_COLLECTION: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^DAR"), "Darcy"),
    (re.compile(r"^HY"), "Hyland"),
    (re.compile(r"^JA"), "Joanna"),
    (re.compile(r"^CAN"), "Canyon"),
    (re.compile(r"^GRA"), "Gracie"),
    (re.compile(r"^BUF"), "Burlington"),
    (re.compile(r"^CV"), "Canova"),
    (re.compile(r"^GRY"), "Grayson"),
    (re.compile(r"^RAM"), "Ramona"),
    (re.compile(r"^MOL"), "Molly"),
    (re.compile(r"^KAR"), "Karina"),
    (re.compile(r"^FIT"), "Fitzgerald"),
    (re.compile(r"^FOR"), "Fortuna"),
    (re.compile(r"^GAR"), "Garcia"),
    (re.compile(r"^LAV"), "Lavon"),
    (re.compile(r"^LUN"), "Luna"),
    (re.compile(r"^GAT"), "Gatlin"),
    (re.compile(r"^CON"), "Conroe"),
    (re.compile(r"^DEN"), "Denver"),
    (re.compile(r"^DAN"), "Daniel"),
    (re.compile(r"^ZEN"), "Zenith"),
    (re.compile(r"^ALX"), "Alexandria"),
    (re.compile(r"^OLS"), "Olsen"),
    (re.compile(r"^KEI"), "Keily"),
    (re.compile(r"^KE8"), "Keily"),
    (re.compile(r"^NOA"), "Noah"),
    (re.compile(r"^SIG"), "Signature"),
    (re.compile(r"^CAS"), "Cassie"),
    (re.compile(r"^MON"), "Montana"),
    (re.compile(r"^RV"), "Riverdale"),
    (re.compile(r"^HP"), "Highland Park"),
    (re.compile(r"^BC"), "Bear Creek"),
    (re.compile(r"^BAR"), "Barron"),
    (re.compile(r"^COZ"), "Cozy"),
    (re.compile(r"^MAR"), "Marlow"),
]

# Generic Volusion labels that omit the collection name.
GENERIC_NAME_PREFIXES = (
    "Casual Occasional",
    "Mixed Media Occasional",
    "Kids Dining Set",
)

# Canonical productname when no same-family sibling already has the right collection.
NAME_TEMPLATES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"PTB?$"), "{collection} Counter Dining Set Counter Height w/ Chairs"),
    (re.compile(r"SVB?$"), "{collection} Server"),
    (re.compile(r"^CAN100(?:KC|NC)$"), "{collection} Cocktail Table w/ Casters"),
    (re.compile(r"^CAN100(?:KE|NE)$"), "{collection} End Table"),
    (re.compile(r"^GRA100(?:WC|NC)$"), "{collection} Round Cocktail Table"),
    (re.compile(r"^GRA100(?:WE|NE)$"), "{collection} Round End Table"),
    (re.compile(r"^JA150C$"), "{collection} Occasional Coffee Table w/ Casters"),
    (re.compile(r"^JA150E$"), "{collection} Occasional End Table"),
    (re.compile(r"^JA300T$"), "{collection} Kids Dining Set Standard w/ Chairs"),
]

PLACEHOLDER_CODES = {
    "Adeline-Patio-Set",
    "Burlington-Dining-Set",
    "Canova-Dining-Set",
    "Delilah-Patio-Chairs",
    "Fitzgerald-Coffee-Table",
    "Fitzgerald-End-Table",
    "Fortuna-Loveseat",
    "Fortuna-Recliner",
    "Garcia-Bar",
    "Grayson-Dining-Set",
    "Karina-Sideboard",
    "Laurel-Sofa-Loveseat",
    "Level-Sofa",
    "Molly-Olson-Dining-Set",
    "Natalia-Sofa-Loveseat",
    "Park-City-Sectional",
    "Ramona-Dining-Set",
    "Sapphire-Sleep-Cal-King",
}

PRODUCTS: dict[str, dict[str, object]] = {
    "Burlington-Dining-Set": {
        "productname": "Burlington 7-Piece Dining Set by Steve Silver",
        "category": CAT_DINING_SET,
        "weight": "235",
        "productiondescription": (
            "The Burlington 52-inch Round Table in mocha forms a centerpiece that marries elegance with style. "
            "The table features a sturdy circular base with ample clearance for chairs, a polygonal circle design, "
            "and a striking black accent on the apron and base that elevates the cocoa finish. "
            "Open-back side chairs feature tapered solid wood legs, shaped upholstered backs, and durable polyester "
            "upholstery for everyday dining comfort."
        ),
        "techspecs": [
            "7-piece dining set with 52-inch round table and six upholstered side chairs",
            "Cocoa finish with black apron and base accent",
            "Crafted from oak veneers, Asian hardwood solids, and engineered woods",
            "Round table seats up to six",
            "300 lb. weight capacity per chair",
            "Table: 52W x 52D x 30H in.; Chair: 20.25W x 23.35D x 35H in.",
        ],
        "keywords": "Burlington dining set, Steve Silver dining set, 7 piece dining set, round dining table, upholstered dining chairs, dining room furniture",
        "images": {
            1: [
                f"{UPLOADS}/2024/09/SteveSilverFurniture__Burlington_BUR520N-TTTB_LS1_copy.jpg",
            ],
            2: [
                f"{UPLOADS}/2024/09/SteveSilverFurniture__Burlington_BUR520N-TTTB_LS1_copy.jpg",
            ],
        },
    },
    "Canova-Dining-Set": {
        "productname": "Canova 7-Piece Dining Set by Steve Silver",
        "category": CAT_DINING_SET,
        "weight": "245",
        "productiondescription": (
            "A charming 52-inch round Canova table combines a refined gray marble top with natural white veining "
            "and a white timber-beam trestle base. Six upholstered side chairs complete this casually elegant set "
            "for farmhouse, cottage, ranch, or transitional dining rooms."
        ),
        "techspecs": [
            "7-piece dining set with 52-inch gray marble-top table and six side chairs",
            "Gray marble veneer top with white veining",
            "Pine solids, veneers, and engineered wood base in white finish",
            "Seats up to six",
            "Transitional farmhouse styling",
            "Table: 52W x 52D x 30.25H in.",
        ],
        "keywords": "Canova dining set, Steve Silver dining set, gray marble dining table, 7 piece dining set, farmhouse dining room, round dining table",
        "images": {
            1: [f"{UPLOADS}/2021/09/SteveSilverCo_Canova_CV520GT_CV520DB_WS2.jpg"],
            2: [
                f"{UPLOADS}/2021/09/SteveSilverCo_Canova_CV520GT_CV520DB_RS2.jpg",
                f"{UPLOADS}/2021/09/SteveSilverCo_Canova_CV520GT_CV520DB_WS2.jpg",
            ],
        },
    },
    "Grayson-Dining-Set": {
        "productname": "Grayson Counter Height Dining Set by Steve Silver",
        "category": CAT_DINING_SET,
        "weight": "420",
        "productiondescription": (
            "Rustic charm meets modern elegance in the Grayson gray marble-top counter dining set. "
            "The 60-inch counter storage table anchors the group with a gray marble veneer top, dusty honey finish, "
            "and concealed storage in the base, paired with counter chairs and a counter bench for everyday dining."
        ),
        "techspecs": [
            "Counter-height dining set with storage table, four counter chairs, and bench",
            "Gray marble veneer top with pine solids and hardwoods",
            "60-inch table seats six comfortably",
            "Storage base with two doors for dining essentials",
            "Antique white and dark oak multi-step finish",
            "Counter-height profile for kitchen and open dining spaces",
        ],
        "keywords": "Grayson dining set, Steve Silver counter dining, marble top dining set, counter height dining, storage dining table",
        "images": {
            1: [f"{UPLOADS}/2022/05/SteveSilverFurniture_Grayson_GS600GSV_WS2.jpg"],
            2: [
                f"{UPLOADS}/2023/02/SteveSilverFurniture_Grayson_GS600GMT_GS600CTB_GS600CCG_GS600CBG_600GSV_RS1-2-copy.jpg",
                f"{UPLOADS}/2022/05/SteveSilverFurniture_Grayson_GS600GMT_GS600CTB_GS600CCG_GS600GSV_RS1.jpg",
            ],
        },
    },
    "Ramona-Dining-Set": {
        "productname": "Ramona 5-Piece Dining Set by Steve Silver",
        "category": CAT_DINING_SET,
        "weight": "205",
        "productiondescription": (
            "Ramona brings mid-century modern mixed-material style to the dining room with a 44-inch round white "
            "marble top, architecturally shaped dark bronze metal base, and ergonomically shaped faux rawhide chairs "
            "that work beautifully for dining or guest seating."
        ),
        "techspecs": [
            "5-piece set with 44-inch round white marble-top table and four side chairs",
            "Powder-coated dark bronze iron base",
            "Mid-century canted-leg chairs with faux rawhide upholstery",
            "Mixed-material modern styling",
            "Table: 44W x 44D x 30H in.",
        ],
        "keywords": "Ramona dining set, Steve Silver dining set, marble dining table, round dining table, mid century dining, 5 piece dining set",
        "images": {
            1: [f"{UPLOADS}/2019/08/Ramona_RM440WT_WS2.jpg"],
            2: [
                f"{UPLOADS}/2019/08/Ramona_RM440WT_RS2.jpg",
                f"{UPLOADS}/2019/08/Ramona_RM440WT_WS2.jpg",
            ],
        },
    },
    "Molly-Olson-Dining-Set": {
        "productname": "Molly Olson 5-Piece Dining Set by Steve Silver",
        "category": CAT_DINING_SET,
        "weight": "210",
        "productiondescription": (
            "The Molly 48-inch round dining set pairs a glass tabletop with sleek upholstered chairs for a clean "
            "mid-century inspired look. Iron legs and warm wood-tone base details add visual interest without "
            "overwhelming the room."
        ),
        "techspecs": [
            "5-piece set with 48-inch round glass-top table and four upholstered chairs",
            "Mid-century inspired iron and wood base",
            "Sleek upholstered seating",
            "Light, open visual profile for smaller dining spaces",
            "Table: 48-inch round",
        ],
        "keywords": "Molly Olson dining set, Steve Silver dining set, glass dining table, round dining set, mid century dining room",
        "images": {
            1: [
                f"{UPLOADS}/2022/06/Costco_Driftwood_Molly_MY5454T_MY400S_RS1-copy-1.jpg",
                f"{UPLOADS}/2019/08/Costco_Driftwood_Molly_MY5454T_MY400S_RS1-copy-1.jpg",
            ],
            2: [f"{UPLOADS}/2022/06/Costco_Driftwood_Molly_MY5454T_MY400S_RS1-copy-1.jpg"],
        },
    },
    "Karina-Sideboard": {
        "productname": "Karina Sideboard by Steve Silver",
        "category": CAT_DINING_SERVER,
        "weight": "230",
        "productiondescription": (
            "The Karina Server brings refined dining-room storage with a marble-style top, glass-front doors, "
            "glass shelving, and interior lighting. The clean finish and illuminated display area make it useful "
            "for serving, storage, or showcasing decorative pieces."
        ),
        "techspecs": [
            "Marble-style top with glass-front doors",
            "Interior lighting for display and serving",
            "Glass shelving and enclosed storage",
            "Transitional dining-room styling",
            "Useful for serving, storage, or display",
        ],
        "keywords": "Karina sideboard, Steve Silver server, dining room buffet, storage cabinet, glass door server, dining storage",
        "images": {
            1: f"{UPLOADS}/2023/08/SteveSilverFurniture_Karina_KA500SV_WS2.jpg",
            2: f"{UPLOADS}/2023/08/SteveSilverFurniture_Karina_KA500SV_RS1.jpg",
        },
    },
    "Adeline-Patio-Set": {
        "productname": "Adeline Wicker Patio 3-Piece Set by Steve Silver",
        "category": "181",
        "weight": "145",
        "productiondescription": (
            "The Adeline outdoor conversation set includes two egg-shaped swivel chairs and a matching side table. "
            "All-weather resin wicker, powder-coated aluminum framing, and solution-dyed cushion covers create "
            "a durable patio grouping for porches, patios, and covered outdoor spaces."
        ),
        "techspecs": [
            "3-piece patio set with two swivel chairs and side table",
            "All-weather resin wicker and aluminum frame",
            "Solution-dyed cushion covers",
            "Egg-shaped swivel chair design",
            "Ideal for patios, porches, and covered outdoor areas",
        ],
        "keywords": "Adeline patio set, Steve Silver outdoor furniture, wicker patio set, swivel patio chairs, outdoor conversation set",
        "images": {
            1: f"{UPLOADS}/2022/07/SteveSilverFurniture_Adeline_ADL500AC_WS2.jpg",
            2: f"{UPLOADS}/2022/07/SteveSilverFurniture_Adeline_ADL500AC_RS1.jpg",
        },
    },
    "Delilah-Patio-Chairs": {
        "productname": "Delilah Patio Chairs (Set of 2) by Steve Silver",
        "category": "181",
        "weight": "118",
        "productiondescription": (
            "Neutral contemporary style for the outdoors with beveled side panels, rust-resistant aluminum frames, "
            "solution-dyed acrylic fabric, and fast-drying outdoor foam cushions. Dalilah patio chairs offer a "
            "sculptural modern alternative to basic patio seating."
        ),
        "techspecs": [
            "Set of two outdoor arm chairs",
            "Rust-resistant aluminum frame",
            "Solution-dyed acrylic fabric with 3.0-density foam cushions",
            "Beveled side panels with modern geometric profile",
            "Chair: 31W x 35D x 29H in.",
        ],
        "keywords": "Delilah patio chairs, Steve Silver outdoor chairs, patio arm chairs, outdoor dining chairs, aluminum patio seating",
        "images": {
            1: f"{UPLOADS}/2022/07/SteveSilverFurniture_DAL600AC_WS2.jpg",
            2: f"{UPLOADS}/2022/07/SteveSIlverFurniture_Dalilah_DAL600AC_Lifestyle.jpg",
        },
    },
    "Fitzgerald-Coffee-Table": {
        "productname": "Fitzgerald Coffee Table by Steve Silver",
        "category": "195",
        "weight": "110",
        "productiondescription": (
            "The Fitzgerald Coffee Table gives a living room a practical center surface with a coordinated "
            "occasional-table look for drinks, books, trays, and decor. Pair with the matching Fitzgerald End Table."
        ),
        "techspecs": [
            "Occasional cocktail table for living rooms and sitting areas",
            "Coordinates with matching Fitzgerald end table",
            "Practical center surface for everyday use",
            "Transitional occasional styling",
        ],
        "keywords": "Fitzgerald coffee table, Steve Silver cocktail table, living room coffee table, occasional table",
        "images": {
            1: f"{UPLOADS}/2023/02/SteveSilverFurniture_Fitzgerald_FTZ100C_WS2.jpg",
            2: f"{UPLOADS}/2023/02/SteveSilverFurniture_Fitzgerald_FTZ100C_RS1.jpg",
        },
    },
    "Fitzgerald-End-Table": {
        "productname": "Fitzgerald End Table by Steve Silver",
        "category": "195",
        "weight": "60",
        "productiondescription": (
            "The Fitzgerald End Table gives a seating area a compact surface for lighting, remotes, drinks, "
            "or decorative accents beside a sofa or chair, and coordinates with the Fitzgerald Coffee Table."
        ),
        "techspecs": [
            "Compact end table for sofa or chairside use",
            "Coordinates with Fitzgerald coffee table",
            "Useful surface for lighting, remotes, and decor",
            "Transitional occasional styling",
        ],
        "keywords": "Fitzgerald end table, Steve Silver end table, living room side table, occasional table",
        "images": {
            1: f"{UPLOADS}/2023/02/SteveSilverFurniture_Fitzgerald_FTZ100E_WS2.jpg",
            2: f"{UPLOADS}/2023/02/SteveSilverFurniture_Fitzgerald_FTZ100E_RS1.jpg",
        },
    },
    "Fortuna-Loveseat": {
        "productname": "Fortuna Power Reclining Console Loveseat by Steve Silver",
        "category": "147",
        "weight": "210",
        "productiondescription": (
            "Fortuna power reclining loveseat with top-grain leather seating areas, power headrest and footrest "
            "controls, USB charging, high-resiliency foam, and a center console with storage and cupholders."
        ),
        "techspecs": [
            "Power reclining loveseat with console",
            "Top-grain leather on seating areas",
            "Power headrest and footrest with USB charging",
            "Center console with storage and cupholders",
            "High-resiliency foam cushioning",
            "Approx. 73.5W x 38D x 41H in.",
        ],
        "keywords": "Fortuna loveseat, Steve Silver power reclining loveseat, leather reclining loveseat, console loveseat, motion furniture",
        "images": {
            1: f"{UPLOADS}/2021/11/SteveSilverFurniture_Fortuna_FT850LC_WS2.jpg",
            2: f"{UPLOADS}/2021/11/SteveSilverFurniture_Fortuna_FT850LC_RS1.jpg",
        },
    },
    "Fortuna-Recliner": {
        "productname": "Fortuna Power Recliner by Steve Silver",
        "category": "186",
        "weight": "125",
        "productiondescription": (
            "Fortuna power recliner with top-grain leather seating areas, power headrest and footrest controls, "
            "USB charging, high-resiliency foam, and a home button to return the seat to its original position."
        ),
        "techspecs": [
            "Single-seat power recliner",
            "Top-grain leather on seating areas",
            "Power headrest and footrest with USB charging",
            "High-resiliency foam cushioning",
            "Approx. 38.5W x 38D x 41H in.",
        ],
        "keywords": "Fortuna recliner, Steve Silver power recliner, leather recliner, power reclining chair, motion furniture",
        "images": {
            1: f"{UPLOADS}/2021/11/SteveSilverFurniture_Fortuna_FT850CC_WS2.jpg",
            2: f"{UPLOADS}/2021/11/SteveSilverFurniture_Fortuna_FT850CC_RS1.jpg",
        },
    },
    "Garcia-Bar": {
        "productname": "Garcia Bar Unit by Steve Silver",
        "category": "194",
        "weight": "250",
        "productiondescription": (
            "The Garcia Bar Unit adds a polished entertainment piece with ebony accents and sleek silver-tone details. "
            "Designed for serving, storage, and display in dining rooms, game rooms, or media spaces."
        ),
        "techspecs": [
            "Bar cabinet for serving and storage",
            "Ebony and silver-tone mixed-media styling",
            "Useful for dining, game room, or media spaces",
            "Glam contemporary bar design",
        ],
        "keywords": "Garcia bar, Steve Silver bar cabinet, home bar furniture, game room bar, entertainment bar",
        "images": {
            1: f"{UPLOADS}/2023/04/SteveSilverFurniture_Garcia_GA500SB_WS2.jpg",
            2: f"{UPLOADS}/2023/04/SteveSilverFurniture_Garcia_GA500SB_RS1.jpg",
        },
    },
    "Laurel-Sofa-Loveseat": {
        "productname": "Laurel Power Reclining Loveseat by Steve Silver",
        "category": "147",
        "weight": "185",
        "productiondescription": (
            "Contemporary Laurel motion loveseat constructed with top-grain leather seating areas, power leg rest, "
            "power articulating headrest, USB charging, and a center console with cupholders and hidden storage."
        ),
        "techspecs": [
            "Power reclining loveseat with console",
            "Top-grain leather seating with vinyl sides and backs",
            "Power headrest and footrest with USB charging",
            "Center console with cupholders and storage",
            "High-resiliency foam cushioning",
        ],
        "keywords": "Laurel loveseat, Steve Silver power reclining loveseat, leather loveseat, reclining loveseat, motion furniture",
        "images": {
            1: f"{UPLOADS}/2021/09/SteveSilverFurniture_Laurel_LL950CLG_WS2.jpg",
            2: f"{UPLOADS}/2021/09/SteveSilverFurniture_Laurel_LL950CLG_RS1.jpg",
        },
    },
    "Level-Sofa": {
        "productname": "Lovell Sofa by Steve Silver",
        "category": "177",
        "weight": "195",
        "productiondescription": (
            "The Lovell Sofa offers approachable everyday comfort with a clean profile for versatile living room "
            "seating as a standalone sofa or coordinated group anchor."
        ),
        "techspecs": [
            "Stationary living room sofa",
            "Clean, versatile everyday profile",
            "Comfort-focused seating for family rooms and living rooms",
            "Coordinates with matching loveseat pieces where available",
        ],
        "keywords": "Lovell sofa, Steve Silver sofa, living room sofa, stationary sofa, family room seating",
        "images": {
            1: f"{UPLOADS}/2023/01/SteveSilverFurniture_Lovell_LV100S_WS2.jpg",
            2: f"{UPLOADS}/2023/01/SteveSilverFurniture_Lovell_LV100S_RS1.jpg",
        },
    },
    "Natalia-Sofa-Loveseat": {
        "productname": "Natalia Power Reclining Loveseat by Steve Silver",
        "category": "147",
        "weight": "185",
        "productiondescription": (
            "Decadent Natalia motion loveseat with top-grain leather seating areas, power articulating headrest, "
            "power footrest, USB charging, and high-resiliency foam in a warm coach/caramel leather tone."
        ),
        "techspecs": [
            "Power reclining loveseat",
            "Top-grain leather on seating areas",
            "Power headrest and footrest with USB charging",
            "High-resiliency foam cushioning",
            "Warm coach/caramel leather color",
        ],
        "keywords": "Natalia loveseat, Steve Silver power reclining loveseat, leather reclining loveseat, motion furniture, power loveseat",
        "images": {
            1: f"{UPLOADS}/2021/09/SteveSilverFurniture_Natalia_NT950CL_WS2.jpg",
            2: f"{UPLOADS}/2021/09/SteveSilverFurniture_Natalia_NT950CL_RS1.jpg",
        },
    },
    "Park-City-Sectional": {
        "productname": "Park City 6-Piece Power Reclining Sectional by Steve Silver",
        "category": "188",
        "weight": "465",
        "productiondescription": (
            "Park City modular dual-power reclining sectional with adjustable headrests and footrests, wide seating, "
            "USB controls, and gray herringbone-style stain-resistant fabric for media rooms and family rooms."
        ),
        "techspecs": [
            "6-piece modular power reclining sectional",
            "Dual-power headrest and footrest controls",
            "USB charging on reclining components",
            "Gray herringbone stain-resistant fabric",
            "Wide seating for media and family rooms",
        ],
        "keywords": "Park City sectional, Steve Silver power reclining sectional, modular sectional, media room sectional, reclining sectional",
        "images": {
            1: f"{UPLOADS}/2023/05/SteveSilverFurniture_ParkCity_PC900SEC_WS2.jpg",
            2: f"{UPLOADS}/2023/05/SteveSilverFurniture_ParkCity_PC900SEC_RS1.jpg",
        },
    },
    "Sapphire-Sleep-Cal-King": {
        "productname": "Sapphire Sleep 14-Inch California King Mattress by Steve Silver",
        "category": "181",
        "weight": "105",
        "productiondescription": (
            "Sapphire Sleep 14-inch California King mattress with phase-change cover, copper-infused fiber, "
            "gel memory foam, and support layers designed for cooling comfort and contouring support."
        ),
        "techspecs": [
            "14-inch California King mattress",
            "Phase-change cooling cover",
            "Copper-infused fiber and gel memory foam layers",
            "Designed for cooling comfort and contouring support",
        ],
        "keywords": "Sapphire Sleep mattress, California King mattress, cooling mattress, gel memory foam mattress, Steve Silver mattress",
        "images": {
            1: f"{UPLOADS}/2023/08/SteveSilverFurniture_SapphireSleep_SS900CK_WS2.jpg",
            2: f"{UPLOADS}/2023/08/SteveSilverFurniture_SapphireSleep_SS900CK_RS1.jpg",
        },
    },
}


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    if len(data) < 5000:
        raise ValueError(f"image too small ({len(data)} bytes): {url}")
    return data


def to_jpeg(data: bytes) -> bytes:
    from PIL import Image  # noqa: PLC0415

    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


def make_thumbnail(src: Path, dest: Path) -> None:
    from PIL import Image  # noqa: PLC0415

    img = Image.open(src)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    w, h = img.size
    max_w, max_h = THUMB_MAX
    scale = min(max_w / w, max_h / h, 1.0)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    if (new_w, new_h) != (w, h):
        resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
        img = img.resize((new_w, new_h), resample)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, format="JPEG", quality=JPEG_QUALITY, optimize=True)


def download_slot(code: str, slot: int, urls: str | list[str], force: bool) -> bool:
    if isinstance(urls, str):
        urls = [urls]
    dest = PHOTOS / f"{code}-{slot}.jpg"
    thumb = PHOTOS / f"{code}-{slot}T.jpg"
    if dest.is_file() and not force:
        if not thumb.is_file():
            make_thumbnail(dest, thumb)
        return True
    for url in urls:
        try:
            dest.write_bytes(to_jpeg(fetch_bytes(url)))
            make_thumbnail(dest, thumb)
            print(f"  image {dest.name}")
            return True
        except Exception as exc:
            print(f"  ::warning:: {code}-{slot}.jpg ({url.rsplit('/', 1)[-1]}): {exc}", file=sys.stderr)
    return False


def finalize_images(code: str) -> None:
    primary = PHOTOS / f"{code}-1.jpg"
    alt = PHOTOS / f"{code}-2.jpg"
    if primary.is_file():
        return
    if alt.is_file():
        primary.write_bytes(alt.read_bytes())
        make_thumbnail(primary, PHOTOS / f"{code}-1T.jpg")
        print(f"  image {primary.name} (from -2)")


def bullets_to_techspecs(bullets: list[str]) -> str:
    return "\n".join(f"• {b}" for b in bullets[:6])


def parse_ss_techspecs(description: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", description or "")).strip()
    if not text:
        return ""
    bullets: list[str] = []
    dim = re.search(r"Dimensions:\s*([^F]+?)(?:Features:|$)", text, re.I)
    if dim:
        bullets.append(dim.group(1).strip().rstrip(";."))
    feat = re.search(r"Features:\s*(.+)$", text, re.I | re.S)
    if feat:
        for part in re.split(r"[;•]\s*", feat.group(1)):
            part = part.strip().rstrip(".")
            if part and len(part) > 8:
                bullets.append(part)
    if not bullets and text:
        bullets = [text[:180]]
    return bullets_to_techspecs(bullets[:6])


def dining_category(name: str, code: str) -> str | None:
    n = name.lower()
    if any(x in n for x in ("server", "buffet", "hutch", "sideboard", "curio")):
        return CAT_DINING_SERVER
    if "dining set" in n or "diningset" in n.replace(" ", ""):
        return CAT_DINING_SET
    if any(x in n for x in ("counter stool", "dining chair", "side chair", "arm chair")) and "patio" not in n:
        return CAT_DINING_CHAIR
    if re.search(r"\bchair\b", n) and "reclin" not in n and "patio" not in n and "occasional" not in n:
        if "dining" in n or code.startswith("SS-"):
            return CAT_DINING_CHAIR
    return None


def meta_title(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip()


def meta_description(name: str, vendor: str) -> str:
    base = vendor or name
    return f"Shop {name} at McCabe's Theater & Living. {base[:140].rstrip()}."[:255]


def internal_sku(code: str) -> str | None:
    m = re.match(r"SS-(.+)$", code, re.I)
    return m.group(1).upper() if m else None


def collection_from_internal_sku(sku: str) -> str | None:
    for pat, name in SKU_COLLECTION:
        if pat.match(sku):
            return name
    return None


def sku_family(sku: str) -> str:
    m = re.match(r"^([A-Z]+\d+)", sku)
    return m.group(1) if m else sku


def name_has_collection(name: str, collection: str) -> bool:
    return bool(re.search(rf"\b{re.escape(collection)}\b", name, re.I))


def is_generic_productname(name: str) -> bool:
    return any(name.startswith(prefix) for prefix in GENERIC_NAME_PREFIXES)


def template_productname(sku: str, collection: str) -> str | None:
    for pat, tmpl in NAME_TEMPLATES:
        if pat.search(sku):
            return tmpl.format(collection=collection)
    return None


def sku_name_group(sku: str) -> str:
    """Group SKUs that should share the same productname shape (PT vs SV vs CAN cocktail, …)."""
    if re.search(r"SVB?$", sku):
        return "server"
    if re.search(r"PTB?$", sku):
        return "counter-set"
    if re.search(r"^CAN100(?:KC|NC)$", sku):
        return "canyon-cocktail"
    if re.search(r"^CAN100(?:KE|NE)$", sku):
        return "canyon-end"
    if re.search(r"^GRA100(?:WC|NC)$", sku):
        return "gracie-cocktail"
    if re.search(r"^GRA100(?:WE|NE)$", sku):
        return "gracie-end"
    if sku in {"JA150C"}:
        return "joanna-coffee"
    if sku in {"JA150E"}:
        return "joanna-end"
    if sku == "JA300T":
        return "joanna-kids-set"
    return sku


def sibling_productname(sku: str, collection: str, family_rows: list[dict[str, str]]) -> str | None:
    group = sku_name_group(sku)
    for row in family_rows:
        other = internal_sku(row["productcode"])
        if not other or other == sku:
            continue
        if sku_name_group(other) != group:
            continue
        other_name = row.get("productname", "")
        if name_has_collection(other_name, collection):
            return other_name
    return None


def replace_collection_words(text: str, wrong: list[str], right: str) -> str:
    if not text:
        return text
    out = text
    for name in wrong:
        out = re.sub(rf"\b{re.escape(name)}\b", right, out, flags=re.I)
    return out


def wrong_collections_for_sku(sku: str, expected: str) -> list[str]:
    wrong = {name for _, name in SKU_COLLECTION if name.lower() != expected.lower()}
    wrong.update({"Casual Occasional", "Mixed Media Occasional", "Kids Dining Set"})
    return sorted(wrong, key=len, reverse=True)


def refresh_name_derived_fields(row: dict[str, str], name: str) -> None:
    row["productname"] = name
    base = name.split(",")[0]
    row["productkeywords"] = f"{base}; Steve Silver"
    row["metatag_keywords"] = row["productkeywords"]
    row["metatag_title"] = meta_title(name)
    row["metatag_description"] = meta_description(name, row.get("productiondescription", ""))


def sync_collection_fields(row: dict[str, str], family_rows: list[dict[str, str]]) -> None:
    code = row["productcode"]
    if code in NAME_OVERRIDES or code in PRODUCTS:
        return
    sku = internal_sku(code)
    if not sku:
        return
    collection = collection_from_internal_sku(sku)
    if not collection:
        return

    name = row.get("productname", "")
    needs_name = not name_has_collection(name, collection) or is_generic_productname(name)
    if needs_name:
        fixed = sibling_productname(sku, collection, family_rows) or template_productname(sku, collection)
        if fixed:
            refresh_name_derived_fields(row, fixed)
            name = fixed

    wrong = [w for w in wrong_collections_for_sku(sku, collection) if w.lower() != collection.lower()]
    for field in ("productdescription", "productiondescription"):
        row[field] = replace_collection_words(row.get(field, ""), wrong, collection)

    if row.get("techspecs", "").strip():
        row["techspecs"] = replace_collection_words(row["techspecs"], wrong, collection)


PLACEHOLDER_PRICES = {"100"}


def load_preserved_prices(path: Path) -> dict[str, tuple[str, str]]:
    if not path.is_file():
        return {}
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        out: dict[str, tuple[str, str]] = {}
        for row in reader:
            code = row.get("productcode", "").strip()
            if not code:
                continue
            out[code] = (row.get("productprice", ""), row.get("saleprice", ""))
        return out


def is_placeholder_price(price: str) -> bool:
    return str(price).strip() in PLACEHOLDER_PRICES


def sync_placeholder_prices(row: dict[str, str], family_rows: list[dict[str, str]]) -> None:
    """Copy real prices onto finish-variant rows Volusion exported as 100 placeholders."""
    if not is_placeholder_price(row.get("productprice", "")):
        return
    sku = internal_sku(row["productcode"])
    if not sku:
        return
    group = sku_name_group(sku)
    for other in family_rows:
        other_code = other["productcode"]
        if other_code == row["productcode"]:
            continue
        other_sku = internal_sku(other_code)
        if not other_sku or sku_name_group(other_sku) != group:
            continue
        other_price = other.get("productprice", "").strip()
        if not other_price or is_placeholder_price(other_price):
            continue
        try:
            if float(other_price.replace(",", "")) <= 150:
                continue
        except ValueError:
            continue
        row["productprice"] = other_price
        other_sale = other.get("saleprice", "").strip()
        row["saleprice"] = other_sale if other_sale else other_price
        return


def apply_preserved_prices(rows: list[dict[str, str]], preserved: dict[str, tuple[str, str]]) -> int:
    applied = 0
    for row in rows:
        code = row["productcode"]
        if code not in preserved:
            continue
        productprice, saleprice = preserved[code]
        if productprice.strip():
            row["productprice"] = productprice
            applied += 1
        if saleprice.strip():
            row["saleprice"] = saleprice
    return applied


def build_sku_family_index(rows: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    index: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        sku = internal_sku(row["productcode"])
        if not sku:
            continue
        index.setdefault(sku_family(sku), []).append(row)
    return index


def enrich_row(row: dict[str, str], force_images: bool) -> dict[str, str]:
    code = row["productcode"]
    name = row.get("productname", "")

    if code in PRODUCTS:
        cfg = PRODUCTS[code]
        row["productname"] = str(cfg["productname"])
        row["productcategory"] = str(cfg["category"])
        row["productweight"] = str(cfg["weight"])
        row["productiondescription"] = str(cfg["productiondescription"])
        row["techspecs"] = bullets_to_techspecs(list(cfg["techspecs"]))  # type: ignore[arg-type]
        kw = str(cfg["keywords"])
        row["productkeywords"] = kw
        row["metatag_keywords"] = kw
        row["metatag_title"] = meta_title(str(cfg["productname"]))
        row["metatag_description"] = meta_description(str(cfg["productname"]), str(cfg["productiondescription"]))
        images = cfg.get("images", {})
        if isinstance(images, dict):
            for slot, urls in images.items():
                download_slot(code, int(slot), urls, force_images)  # type: ignore[arg-type]
            finalize_images(code)
        return row

    if code in NAME_OVERRIDES:
        name = NAME_OVERRIDES[code]
        row["productname"] = name
        row["metatag_title"] = meta_title(name)

    desc = row.get("productdescription", "")
    if not row.get("productiondescription", "").strip() and desc.strip():
        row["productiondescription"] = unescape(re.sub(r"<[^>]+>", " ", desc)).strip()

    if not row.get("techspecs", "").strip() and desc.strip():
        if "<ul>" in desc:
            bullets = [strip_html(li) for li in re.findall(r"<li[^>]*>(.*?)</li>", desc, re.I | re.S)]
            bullets = [b for b in bullets if b]
            if bullets:
                row["techspecs"] = bullets_to_techspecs(bullets[:6])
        else:
            parsed = parse_ss_techspecs(desc)
            if parsed:
                row["techspecs"] = parsed

    if row.get("productcategory") == "193":
        cat = dining_category(name, code)
        if cat:
            row["productcategory"] = cat

    if not row.get("productweight", "").strip():
        m = re.search(r"(\d{2,4})\s*lb", desc, re.I)
        if m:
            row["productweight"] = m.group(1)

    if not row.get("productkeywords", "").strip():
        base = name.split(",")[0]
        row["productkeywords"] = f"{base}; Steve Silver"
        row["metatag_keywords"] = row["productkeywords"]
    if not row.get("metatag_title", "").strip():
        row["metatag_title"] = meta_title(name)
    if not row.get("metatag_description", "").strip():
        row["metatag_description"] = meta_description(name, row.get("productiondescription", ""))

    return row


def strip_html(text: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return " ".join(text.split())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC)
    parser.add_argument("--dest", type=Path, default=DEFAULT_DEST)
    parser.add_argument("--force-images", action="store_true")
    parser.add_argument(
        "--preserve-prices-from",
        type=Path,
        default=None,
        help="Keep productprice/saleprice from this CSV (defaults to --dest when it already exists)",
    )
    parser.add_argument(
        "--no-preserve-prices",
        action="store_true",
        help="Take prices only from --src (overwrites any manual price edits in --dest)",
    )
    args = parser.parse_args()

    preserved_prices: dict[str, tuple[str, str]] = {}
    if not args.no_preserve_prices:
        preserve_path = args.preserve_prices_from or args.dest
        preserved_prices = load_preserved_prices(preserve_path)

    with args.src.open(newline="", encoding="cp1252") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        rows = [dict(zip(header, row + [""] * (len(header) - len(row)))) for row in reader]

    if "" in header:
        idx = header.index("")
        header[idx] = "productiondescription"

    for row in rows:
        if "productiondescription" not in row:
            row["productiondescription"] = row.pop("", "")
        enrich_row(row, args.force_images)

    family_index = build_sku_family_index(rows)
    for row in rows:
        sku = internal_sku(row["productcode"])
        if sku:
            sync_collection_fields(row, family_index.get(sku_family(sku), []))
            sync_placeholder_prices(row, family_index.get(sku_family(sku), []))

    price_applied = apply_preserved_prices(rows, preserved_prices)

    args.dest.parent.mkdir(parents=True, exist_ok=True)
    with args.dest.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    filled = sum(1 for r in rows if r.get("techspecs", "").strip())
    weights = sum(1 for r in rows if r.get("productweight", "").strip())
    print(f"Wrote {len(rows)} rows -> {args.dest}")
    print(f"Rows with techspecs: {filled}; rows with weight: {weights}")
    if price_applied:
        print(f"Preserved manual prices for {price_applied} row(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
