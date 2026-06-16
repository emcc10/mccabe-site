"""Extract Saranoni adult collection product handles from saved wholesale HTML."""
from __future__ import annotations

import re
from pathlib import Path

HTML = Path(
    r"c:\Users\erink\OneDrive\Documents\saraoni\Adult Extra Large Luxury Blankets by Saranoni – Saranoni Wholesale.htm"
)
text = HTML.read_text(encoding="utf-8", errors="replace")
handles = sorted(
    set(
        re.findall(
            r"wholesale\.saranoni\.com/collections/adult/products/([a-z0-9-]+)",
            text,
            re.I,
        )
    )
)
for h in handles:
    print(h)
print("COUNT", len(handles))
