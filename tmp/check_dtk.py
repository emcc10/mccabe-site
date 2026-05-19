from pathlib import Path
s = Path("vspfiles/templates/266/js/min/design-toolkit.min.js").read_text(encoding="utf-8")
i = s.find("mc-plp-enforcer")
print(s[i - 80 : i + 200] if i >= 0 else "not found")
i2 = s.find("MC_DTK_PLP")
print(s[i2 : i2 + 120] if i2 >= 0 else "no marker")
