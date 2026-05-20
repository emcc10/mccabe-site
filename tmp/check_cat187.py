import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"


def photos_in(url: str) -> set[str]:
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode("utf-8", "replace")
    return set(re.findall(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", html, re.I))


all_p: set[str] = set()
for page in [1, 2, 3]:
    sep = "&" if "?" in "/category-s/187.htm" else "?"
    url = f"{SITE}/category-s/187.htm{sep}Page={page}" if page > 1 else f"{SITE}/category-s/187.htm"
    try:
        p = photos_in(url)
        print(f"Page {page}: {len(p)} photos")
        all_p |= p
    except Exception as exc:
        print(f"Page {page}: {exc}")

print(f"Total unique: {len(all_p)}")
print(sorted(all_p))
