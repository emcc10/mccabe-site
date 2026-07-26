#!/usr/bin/env python3
"""Patch baked Volusion .htm files via SFTP (no Cloudflare needed).

Goals:
  - Product pages: do NOT load mc-plp-enforcer (sticky CDN thrash froze Barron/sofas)
  - Product pages: single stable auth boot (no strip/reinject, no Date.now() double load)
  - Remove thrashing mc-plp-enforcer-hotload-* injectors from older deploys
  - Category/home: bump enforcer ?v= only (never re-inject hotloaders)
"""
from __future__ import annotations

import os
import re
import sys

from verify_template_sftp import connect_paramiko_transport

WANT = os.environ.get("MC_ENFORCER_WANT", "20260727009live1").strip() or "20260727009live1"
AUTH_SRC = (
    os.environ.get("MC_AUTH_SRC", "").strip()
    or "/v/vspfiles/js/mc-pdp-auth-cta-form.js?v=20260725live1&mcrd=live1"
)
DEPLOY_META = os.environ.get("MC_DEPLOY_META", "20260727009live1").strip() or "20260727009live1"

OLD_VER_RE = re.compile(
    r'(src=["\'])/v/vspfiles/js/mc-plp-enforcer\.js\?v=[^"\']+(["\'])',
    re.I,
)
HOTLOADER_RE = re.compile(
    r'<script\b[^>]*\bid=["\']mc-plp-enforcer-hotload-[^"\']+["\'][^>]*>.*?</script>',
    re.I | re.S,
)
STATIC_ENF_RE = re.compile(
    r'<script\b[^>]*\bid=["\']mc-plp-enforcer-js["\'][^>]*>.*?</script>'
    r'|<script\b[^>]*\bsrc=["\'][^"\']*mc-plp-enforcer\.js[^"\']*["\'][^>]*>\s*</script>',
    re.I | re.S,
)
BOOT_RE = re.compile(
    r"<script>\s*\(function\s*\(\s*g\s*,\s*d\s*\)\s*\{.*?"
    r"function\s+bootFreshCta\s*\(\s*\)\s*\{.*?"
    r"\}\)\s*\(\s*window\s*,\s*document\s*\)\s*;\s*</script>",
    re.I | re.S,
)
FALLBACK_RE = re.compile(
    r'<script\b[^>]*\bid=["\']mc-pdp-auth-loader-minimal["\'][^>]*>.*?</script>',
    re.I | re.S,
)
META_RE = re.compile(
    r'<meta\s+name=["\']mc-deploy-verify["\']\s+content=["\'][^"\']*["\']\s*/?>',
    re.I,
)

SAFE_BOOT = f"""<script>
(function (g, d) {{
  var FP = "20260725fix3";
  var AUTH_SRC = "{AUTH_SRC}";
  function isPdp() {{
    try {{
      var p = String(g.location.pathname || "").toLowerCase();
      if (/\\/product-p\\//.test(p) || /productdetails\\.asp/i.test(p)) return true;
    }} catch (ePath) {{}}
    return !!d.getElementById("v65-product-parent");
  }}
  function bootFreshCta() {{
    if (!isPdp()) return;
    if (String(g.__MC_DEPLOY_FP__ || "") === FP) return;
    if (d.documentElement.getAttribute("data-mc-pdp-auth-head-boot") === FP) return;
    if (d.querySelector('script[src*="mc-pdp-auth-cta-form.js"]')) {{
      d.documentElement.setAttribute("data-mc-pdp-auth-head-boot", FP);
      return;
    }}
    d.documentElement.setAttribute("data-mc-pdp-auth-head-boot", FP);
    var s = d.createElement("script");
    s.id = "mc-pdp-auth-cta-form-js";
    s.src = AUTH_SRC;
    s.async = false;
    (d.head || d.documentElement).appendChild(s);
  }}
  bootFreshCta();
  d.addEventListener("DOMContentLoaded", bootFreshCta);
}})(window, document);
</script>"""

SAFE_FALLBACK = f"""<script id="mc-pdp-auth-loader-minimal">
(function () {{
  var FP = "20260725fix3";
  var AUTH_SRC = "{AUTH_SRC}";
  if (String(window.__MC_DEPLOY_FP__ || "") === FP) {{
  }} else if (
    document.documentElement.getAttribute("data-mc-pdp-auth-reload") !== FP &&
    document.documentElement.getAttribute("data-mc-pdp-auth-head-boot") !== FP &&
    !document.querySelector('script[src*="mc-pdp-auth-cta-form.js"]')
  ) {{
    document.documentElement.setAttribute("data-mc-pdp-auth-reload", FP);
    var s = document.createElement("script");
    s.id = "mc-pdp-auth-cta-form-js-fallback";
    s.src = AUTH_SRC;
    s.async = false;
    (document.head || document.documentElement).appendChild(s);
  }}
  window.openPlannerOverlay = function () {{}};
  window.mcEnsurePlannerLoginGate = function () {{ return null; }};
  window.mcSetPlannerLoginGateVisible = function () {{}};
  window.mcApplyPlannerAtcDisabledState = function () {{}};
  window.mcOpenWmLeatherModal = function () {{}};
  window.mcOpenWmLeatherOverlay = function () {{ return false; }};
  window.mcForceInitWmLeather = function () {{ return false; }};
  window.mcTryInitWmLeather = function () {{ return false; }};
  window.mcMountInlineConfig = function () {{}};
}})();
</script>"""

PDP_ENF_SKIP = f"""<script id="mc-plp-enforcer-js">
/* MC_PLP_ENFORCER_STATIC_{WANT} — skip product pages entirely */
(function (g, d) {{
  try {{
    var p = String(g.location.pathname || "").toLowerCase();
    if (/\\/product-p\\//.test(p) || /productdetails\\.asp/i.test(p)) return;
    if (d.getElementById("v65-product-parent")) return;
  }} catch (eSkip) {{}}
  if (d.getElementById("mc-plp-enforcer-js-src")) return;
  if (typeof g.mcPlpEnforcerRun === "function" && g.__MC_PLP_ENFORCER_VER__) return;
  var s = d.createElement("script");
  s.id = "mc-plp-enforcer-js-src";
  s.src = "/v/vspfiles/js/mc-plp-enforcer.js?v={WANT}&mcrd=live1";
  (d.head || d.documentElement).appendChild(s);
}})(window, document);
</script>"""

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


def _walk_htm(sftp, root: str, limit: int = 2000) -> list[str]:
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


def _is_product_html(path: str, text: str) -> bool:
    pl = path.lower()
    if "/product-p/" in pl or pl.endswith("-p.htm") or pl.endswith("-p.html"):
        return True
    if 'id="v65-product-parent"' in text or "id='v65-product-parent'" in text:
        return True
    if "bootFreshCta" in text and "mc-pdp-auth-cta-form.js" in text:
        return True
    return False


def _patch_bytes(path: str, raw: bytes) -> tuple[bytes, bool]:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    if "mc-plp-enforcer" not in text and "bootFreshCta" not in text and "mc-pdp-auth" not in text:
        return raw, False

    changed = False
    is_pdp = _is_product_html(path, text)

    # Always strip thrashing hotloaders from prior deploys.
    new_text, n_hot = HOTLOADER_RE.subn("", text)
    if n_hot:
        changed = True
        text = new_text

    if is_pdp:
        new_text, n_boot = BOOT_RE.subn(SAFE_BOOT, text, count=1)
        if n_boot:
            changed = True
            text = new_text
        new_text, n_fb = FALLBACK_RE.subn(SAFE_FALLBACK, text, count=1)
        if n_fb:
            changed = True
            text = new_text
        if STATIC_ENF_RE.search(text):
            new_text, n_enf = STATIC_ENF_RE.subn(PDP_ENF_SKIP, text, count=1)
            if n_enf:
                changed = True
                text = new_text
        # Remove any remaining static enforcer src tags on PDPs.
        new_text, n_src = re.subn(
            r'<script\b[^>]*\bsrc=["\'][^"\']*mc-plp-enforcer\.js[^"\']*["\'][^>]*>\s*</script>',
            "",
            text,
            flags=re.I,
        )
        if n_src:
            changed = True
            text = new_text
        new_text, n_meta = META_RE.subn(
            f'<meta name="mc-deploy-verify" content="{DEPLOY_META}">',
            text,
            count=1,
        )
        if n_meta:
            changed = True
            text = new_text
    else:
        new_text, n = OLD_VER_RE.subn(
            rf'\1/v/vspfiles/js/mc-plp-enforcer.js?v={WANT}&mcrd=live1\2',
            text,
        )
        if n:
            changed = True
            text = new_text

    if not changed:
        return raw, False
    return text.encode("utf-8"), True


def main() -> int:
    host, port, user, password = _creds()
    if not host or not user or not password:
        print("::warning::No SFTP creds — skip baked HTML enforcer patch", flush=True)
        return 0

    print(
        f"=== Patch baked HTML (PDP unfreeze + enforcer v={WANT}, no hotloaders) ===",
        flush=True,
    )
    try:
        transport = connect_paramiko_transport(host, port, user, password)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::SFTP connect failed for HTML patch: {exc}", flush=True)
        return 0

    import paramiko  # noqa: PLC0415

    patched = 0
    scanned = 0
    pdp_patched = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        assert sftp is not None
        priority = [
            "/product-p/ss-barron-87sofa.htm",
            "/product-p/ss-barron-65love.htm",
            "/product-p/ss-barron-recl.htm",
            "/product-p/ss-luna-ice-pwr-sofa.htm",
            "product-p/ss-barron-87sofa.htm",
            "product-p/ss-barron-65love.htm",
            "product-p/ss-barron-recl.htm",
            "product-p/ss-luna-ice-pwr-sofa.htm",
            "/v/product-p/ss-barron-87sofa.htm",
            "/mccabestheaterandliving.com/product-p/ss-barron-87sofa.htm",
        ]
        candidates: list[str] = list(priority)
        for root in SEARCH_ROOTS:
            candidates.extend(_walk_htm(sftp, root))
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
            if (
                b"mc-plp-enforcer" not in raw
                and b"bootFreshCta" not in raw
                and b"mc-pdp-auth" not in raw
            ):
                continue
            new_raw, changed = _patch_bytes(remote, raw)
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
            if _is_product_html(remote, new_raw.decode("utf-8", errors="ignore")):
                pdp_patched += 1
            print(f"::notice::Patched {remote}", flush=True)
    finally:
        try:
            transport.close()
        except Exception:
            pass

    print(
        f"::notice::Baked HTML patch done scanned={scanned} patched={patched} pdp={pdp_patched}",
        flush=True,
    )
    if patched == 0:
        print(
            "::warning::No baked .htm files patched on SFTP. "
            "Do Volusion Design → File Editor → template_266.html → Save to rebake.",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
