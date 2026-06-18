import subprocess
from pathlib import Path

root = Path(r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site")
files = [
    "template_266.html",
    "vspfiles/css/custom-safe.css",
    "vspfiles/js/mc-pdp-auth-cta-fix.js",
    "vspfiles/js/mc-unified-pdp-layout.js",
]
old, new = "20260617pdp70", "20260617pdp71"

for rel in files:
    p = root / rel
    text = p.read_text(encoding="utf-8")
  # normalize line endings for git? keep as-is
    if old not in text:
        raise SystemExit(f"missing {old} in {rel}")
    p.write_text(text.replace(old, new), encoding="utf-8", newline="\n")
    data = p.read_bytes()
    h = subprocess.check_output(
        ["git", "hash-object", "-w", "--stdin"], input=data, cwd=root
    ).decode().strip()
    subprocess.check_call(
        ["git", "update-index", "--cacheinfo", f"100644,{h},{rel}"],
        cwd=root,
    )
    subprocess.check_call(
        ["git", "update-index", "--no-assume-unchanged", rel], cwd=root
    )
    print("staged", rel, len(data), h[:12])

subprocess.check_call(["git", "diff", "--cached", "--stat"], cwd=root)
