import re
import sys

sys.path.insert(0, r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\scripts")
from steve_silver_vendor_copy import fetch_text, parse_json_ld_product

for term in ["gabby 48", "gab 4848", "garland 48 dining", "GAB4848"]:
    html = fetch_text(f"https://stevesilver.com/?s={term.replace(' ', '+')}")
    links = list(dict.fromkeys(re.findall(r'href="(https://stevesilver.com/product/[^"]+)"', html)))
    print(term, "->", len(links), "results")
    for link in links[:5]:
        page = fetch_text(link)
        info = parse_json_ld_product(page)
        print(" ", info.get("sku"), (info.get("name") or "")[:70])
