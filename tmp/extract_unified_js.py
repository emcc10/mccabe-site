#!/usr/bin/env python3
"""Extract mcNormalizePdpLayout block from template_266.html into standalone JS."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
tpl = (ROOT / "template_266.html").read_text(encoding="utf-8")
start = tpl.find('(function () {\n  "use strict";\n\n  var LAYOUT_VER = "20260616unified2"')
end = tpl.find("})();\n</script>\n\n<!-- MC removed legacy PDP accordion", start)
if start == -1 or end == -1:
    raise SystemExit("Could not find unified layout script block")

body = tpl[start : end + 4]  # include })();
body = body.replace("document.", "global.document.")
body = body.replace("(root || document)", "(root || global.document)")
body = body.replace("typeof window.", "typeof global.")
body = body.replace("window.", "global.")
body = body.replace("global.document.body", "global.document.body")  # noop

out = (
    "/**\n"
    " * MC unified PDP layout — runs without template rebake.\n"
    " * Loaded by mc-pdp-auth-cta-fix.js on product detail pages.\n"
    " */\n"
    "(function (global) {\n"
    '  "use strict";\n'
    + body[body.find('"use strict";') + len('"use strict";') :]
)
out = out.replace("(function () {", "", 1)
if not out.rstrip().endswith("})(window);"):
    out = out.rstrip()
    if out.endswith("})();"):
        out = out[:-5] + "})(window);\n"
    else:
        out += "\n})(window);\n"

dest = ROOT / "vspfiles/js/mc-unified-pdp-layout.js"
dest.write_text(out, encoding="utf-8", newline="\n")
print("Wrote", dest, "bytes", dest.stat().st_size)
