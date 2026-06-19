import json
import urllib.request

url = "https://saranoni.com/products/harry-potter-muslin-nursery.json"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
print(raw[:500])
data = json.loads(raw)
print("keys", data.keys() if isinstance(data, dict) else type(data))
if isinstance(data, dict) and "product" in data:
    p = data["product"]
elif isinstance(data, dict):
    p = data
else:
    raise SystemExit("unexpected")
print("options:")
for o in p.get("options", []):
    print(" ", o.get("name"), o.get("values"))
variants = p.get("variants", [])
print("variant count", len(variants))
base = min(float(v["price"]) for v in variants)
for v in variants:
    print(v.get("option1"), "|", v.get("option2"), "|", v["price"], "| diff", round(float(v["price"]) - base, 2))
