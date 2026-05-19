import json
import re
import urllib.request

d = json.load(open("vspfiles/js/mc-plp-sofa-bounds.json"))
ref = d["77494-91-1.jpg"]["visibleW"]
html = urllib.request.urlopen("https://www.mccabestheaterandliving.com/category-s/177.htm", timeout=60).read().decode("utf-8", "replace")
for name in ["Barrett", "Lexi", "Alula", "Juno Apartment", "Viceroy", "Juno Sofa", "Martina"]:
    m = re.search(rf"{name}[\s\S]{{0,500}}?photos/([^\"']+\.jpg)", html, re.I)
    if m:
        f = m.group(1).lower()
        b = d.get(f)
        if b:
            print(f"{name:20} {f:20} visW={b['visibleW']:4} scale={ref/b['visibleW']:.3f}")
        else:
            print(f"{name:20} {f:20} NO BOUNDS")
    else:
        print(f"{name:20} not on page1")
print("ref", ref)
print("--- widest ---")
for k, v in sorted(d.items(), key=lambda x: -x[1]["visibleW"])[:6]:
    print(k, v["visibleW"], round(ref / v["visibleW"], 3))
print("--- narrowest ---")
for k, v in sorted(d.items(), key=lambda x: x[1]["visibleW"])[:6]:
    print(k, v["visibleW"], round(ref / v["visibleW"], 3))
