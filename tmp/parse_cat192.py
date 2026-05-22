import re
import urllib.request

UA = {"User-Agent": "x"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/192.htm", headers=UA
    ),
    timeout=90,
).read().decode("utf-8", "replace")

# productnamecolor links
for m in re.finditer(
    r'<a href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"[^>]*class="[^"]*productnamecolor',
    html,
    re.I,
):
    title_m = re.search(r">([^<]+)<", html[m.end() : m.end() + 80])
    title = title_m.group(1).strip() if title_m else "?"
    print(title[:60], m.group(1)[-40:])

print("\nphotos:", sorted(set(re.findall(r"/photos/([^\"'?]+)", html, re.I))))
