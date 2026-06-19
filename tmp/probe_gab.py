import re
import sys
sys.path.insert(0, r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\scripts")
from steve_silver_vendor_copy import fetch_text, find_product_url, fetch_vendor_copy, parse_json_ld_product, parse_bullets

for sku in ["GAB4848T", "GAB4848", "GAB48"]:
    print(sku, find_product_url(sku))

html = fetch_text("https://stevesilver.com/?s=gabby+48+dining+table")
links = list(dict.fromkeys(re.findall(r'href="(https://stevesilver.com/product/[^"]+)"', html)))
print("search links", len(links))
for link in links[:8]:
    page = fetch_text(link)
    info = parse_json_ld_product(page)
    print(link.split('/')[-2], info.get('sku'), info.get('name','')[:60])
