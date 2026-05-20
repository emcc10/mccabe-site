from pathlib import Path

path = Path("vspfiles/templates/266/js/min/design-toolkit.min.js")
block = Path("tmp/dtk_block_20260617.txt").read_text(encoding="utf-8")
s = path.read_text(encoding="utf-8")
start = s.index("MC_DTK_PLP_")
end = s.index("})(window,document);", start) + len("})(window,document);")
path.write_text(s[:start] + block + s[end:], encoding="utf-8")
print("patched", path, "marker", block[:24])
