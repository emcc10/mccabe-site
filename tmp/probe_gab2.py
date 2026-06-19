import re
import sys

sys.path.insert(0, r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\scripts")
from steve_silver_vendor_copy import fetch_text, parse_json_ld_product

html = fetch_text("https://stevesilver.com/?s=gabby+dining")
links = list(dict.fromkeys(re.findall(r'href="(https://stevesilver.com/product/[^"]+)"', html)))
for link in links:
    page = fetch_text(link)
    info = parse_json_ld_product(page)
    print(info.get("sku"), (info.get("name") or "")[:80])
