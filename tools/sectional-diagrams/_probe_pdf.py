import fitz
from pathlib import Path


def drawings_union(pg):
    dlist = pg.get_drawings()
    if not dlist:
        return None
    u = None
    for d in dlist:
        r = d.get("rect")
        if r is None:
            continue
        rr = fitz.Rect(r)
        if u is None:
            u = rr
        else:
            u |= rr
    return u


p = Path(__file__).parent / "pdfs" / "Alula.pdf"
doc = fitz.open(p)
for i in range(min(8, len(doc))):
    pg = doc[i]
    tb = pg.get_text("blocks")
    tu = None
    if tb:
        tu = fitz.Rect(tb[0][:4])
        for b in tb[1:]:
            tu |= fitz.Rect(b[:4])
    du = drawings_union(pg)
    if tu is not None and du is not None:
        comb = tu | du
    elif tu is not None:
        comb = tu
    else:
        comb = du
    print("page", i + 1, "drawings", len(pg.get_drawings()) if pg.get_drawings() else 0)
    print("  text", tuple(tu) if tu else None)
    print("  draw", tuple(du) if du else None)
    print("  combo", tuple(comb) if comb else None)
doc.close()
