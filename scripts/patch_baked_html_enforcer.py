#!/usr/bin/env python3
"""Rewrite stale mc-plp-enforcer.js?v=… refs in baked Volusion .htm files via SFTP.

No Cloudflare purge needed: homepage/category HTML is CF DYNAMIC. Changing the
script query string makes browsers request a URL that is not year-cached.

Also injects a tiny &mcrd= hotloader before </body> when missing.
"""
from __future__ import annotations

import os
import re
import sys

from verify_template_sftp import connect_paramiko_transport

WANT = os.environ.get("MC_ENFORCER_WANT", "20260727001fix1").strip() or "20260727001fix1"
OLD_VER_RE = re.compile(
    r'(src=["\'])/v/vspfiles/js/mc-plp-enforcer\.js\?v=[^"\']+(["\'])',
    re.I,
)
HOT_ID = f"mc-plp-enforcer-hotload-{WANT}"
HOTLOADER = f"""<script id="{HOT_ID}">
(function(g,d){{var W="{WANT}",vn=function(v){{var n=parseInt(String(v||"").replace(/\\D/g,""),10);return isNaN(n)?0:n;}};
function go(){{if(vn(g.__MC_PLP_ENFORCER_VER__)>=vn(W)&&typeof g.mcPlpEnforcerRun==="function"){{try{{g.mcPlpEnforcerRun();}}catch(e){{}}return;}}
d.querySelectorAll('script[src*="mc-plp-enforcer"]').forEach(function(s){{try{{s.remove();}}catch(e2){{}}}});
try{{delete g.__MC_PLP_ENFORCER__;delete g.__MC_PLP_ENFORCER_VER__;delete g.mcPlpEnforcerRun;}}catch(e3){{}}
var s=d.createElement("script");s.id="mc-plp-enforcer-js";s.src="/v/vspfiles/js/mc-plp-enforcer.js?v="+W+"&mcrd="+Date.now();
s.onload=function(){{try{{g.mcPlpEnforcerRun&&g.mcPlpEnforcerRun();}}catch(e4){{}}}};
(d.head||d.documentElement).appendChild(s);}}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",go);else go();
g.addEventListener("load",go);[50,400,1500].forEach(function(t){{g.setTimeout(go,t);}});
}})(window,document);
</script>
"""

# Volusion often keeps baked category HTML beside the public URL path.
SEARCH_ROOTS = (
    "/",
    "/v",
    "/mahjong-s",
    "/sofas-s",
    "/sectionals-s",
    "/bean-bag-seating-s",
    "/palliser-theater-seating-s",
    "/category-s",
    "/product-p",
    "/vspfiles",
    "/v/vspfiles",
    "/mccabestheaterandliving.com",
)


def _creds() -> tuple[str, int, str, str]:
    host = (
        os.environ.get("SFTP_HOST", "").strip()
        or os.environ.get("FTP_SERVER", "").strip()
        or os.environ.get("SECRET_FTP_SERVER", "").strip()
    )
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("SECRET_FTP_PORT") or "2222")
    user = os.environ.get("SFTP_USER") or os.environ.get("FTP_USERNAME") or ""
    password = os.environ.get("SFTP_PASS") or os.environ.get("FTP_PASSWORD") or ""
    return host, port, user, password


def _listdir(sftp, path: str) -> list:
    try:
        return sftp.listdir_attr(path)
    except OSError:
        return []


def _walk_htm(sftp, root: str, limit: int = 400) -> list[str]:
    found: list[str] = []
    stack = [root.rstrip("/") or "/"]
    seen: set[str] = set()
    while stack and len(found) < limit:
        cur = stack.pop()
        if cur in seen:
            continue
        seen.add(cur)
        for ent in _listdir(sftp, cur):
            name = ent.filename
            if name in (".", ".."):
                continue
            path = (cur.rstrip("/") + "/" + name) if cur != "/" else "/" + name
            mode = getattr(ent, "st_mode", 0) or 0
            is_dir = False
            try:
                import stat

                is_dir = stat.S_ISDIR(mode)
            except Exception:
                is_dir = name.endswith("-s") or name in (
                    "v",
                    "vspfiles",
                    "category-s",
                    "product-p",
                    "mccabestheaterandliving.com",
                )
            if is_dir:
                # Stay shallow-ish: only descend into category-like folders.
                if name.endswith("-s") or name in (
                    "v",
                    "vspfiles",
                    "category-s",
                    "product-p",
                    "mahjong",
                    "mccabestheaterandliving.com",
                ):
                    stack.append(path)
                continue
            if name.lower().endswith((".htm", ".html")):
                found.append(path)
    return found


def _patch_bytes(raw: bytes) -> tuple[bytes, bool]:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    if "mc-plp-enforcer.js" not in text:
        return raw, False
    changed = False
    new_text, n = OLD_VER_RE.subn(rf'\1/v/vspfiles/js/mc-plp-enforcer.js?v={WANT}\2', text)
    if n:
        changed = True
        text = new_text
    if HOT_ID not in text and "mc-plp-enforcer.js" in text:
        if re.search(r"</body\s*>", text, re.I):
            text = re.sub(r"</body\s*>", HOTLOADER + "</body>", text, count=1, flags=re.I)
            changed = True
        elif re.search(r"</html\s*>", text, re.I):
            text = re.sub(r"</html\s*>", HOTLOADER + "</html>", text, count=1, flags=re.I)
            changed = True
    if not changed:
        return raw, False
    return text.encode("utf-8"), True


def main() -> int:
    host, port, user, password = _creds()
    if not host or not user or not password:
        print("::warning::No SFTP creds — skip baked HTML enforcer patch", flush=True)
        return 0

    print(f"=== Patch baked HTML enforcer refs → v={WANT} (no Cloudflare needed) ===", flush=True)
    try:
        transport = connect_paramiko_transport(host, port, user, password)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::SFTP connect failed for HTML patch: {exc}", flush=True)
        return 0

    import paramiko  # noqa: PLC0415

    patched = 0
    scanned = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        assert sftp is not None
        candidates: list[str] = []
        for root in SEARCH_ROOTS:
            candidates.extend(_walk_htm(sftp, root))
        # Dedupe
        seen: set[str] = set()
        uniq: list[str] = []
        for p in candidates:
            if p not in seen:
                seen.add(p)
                uniq.append(p)

        print(f"::notice::Found {len(uniq)} .htm/.html candidates to scan", flush=True)
        for remote in uniq:
            scanned += 1
            try:
                with sftp.open(remote, "rb") as handle:
                    raw = handle.read()
            except OSError:
                continue
            if b"mc-plp-enforcer" not in raw and b"20260725fix3" not in raw:
                continue
            new_raw, changed = _patch_bytes(raw)
            if not changed:
                continue
            tmp = remote + ".enf-patch-tmp"
            try:
                try:
                    sftp.remove(tmp)
                except OSError:
                    pass
                with sftp.open(tmp, "wb") as handle:
                    handle.write(new_raw)
                try:
                    sftp.remove(remote)
                except OSError:
                    pass
                sftp.rename(tmp, remote)
            except OSError as exc:
                print(f"::warning::Failed to write {remote}: {exc}", flush=True)
                continue
            patched += 1
            print(f"::notice::Patched {remote}", flush=True)
    finally:
        try:
            transport.close()
        except Exception:
            pass

    print(
        f"::notice::Baked HTML enforcer patch done scanned={scanned} patched={patched}",
        flush=True,
    )
    if patched == 0:
        print(
            "::warning::No baked .htm files patched on SFTP. "
            "Homepage still needs Volusion Design → File Editor → template_266.html → Save "
            "(no Cloudflare). That rebake points / at ?v="
            f"{WANT} which is already a good CDN entry.",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
