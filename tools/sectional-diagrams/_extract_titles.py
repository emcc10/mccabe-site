import json
import re
from pathlib import Path

html = (
    Path("_cat187.html").read_text(encoding="utf-8", errors="ignore")
    + Path("_cat188.html").read_text(encoding="utf-8", errors="ignore")
)
rx = re.compile(r'title="([^"]+Sectional Configuration[^"]+)"', re.I)
titles: dict[str, str] = {}
for t in rx.findall(html):
    m = re.match(r"(\w+)\s+Sectional\s+Configuration\s+(.+)", t.strip(), re.I)
    if m:
        raw = m.group(1)
        key = raw[:1].upper() + raw[1:].lower()
        titles[key] = m.group(2).strip()
Path("mccabe_plp_titles.json").write_text(json.dumps(titles, indent=2), encoding="utf-8")
print(json.dumps(titles, indent=2))
