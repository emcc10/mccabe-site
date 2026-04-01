#!/usr/bin/env python3
"""
After deploy: confirm mc-deploy-verify matches Git.

1) SFTP: reject stale /v/ copies when those files exist.
2) HTTP: public template URL must show the same marker (cache-busted). This catches
   the case where SFTP only updated /template_266.html but the browser still reads /v/.
"""
from __future__ import annotations

import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
import ssl

# SFTP paths that might be the live theme (browser …/v/template_266.html)
_CANONICAL_V_PATHS: tuple[str, ...] = (
    "/v/template_266.html",
    "/mccabestheaterandliving.com/v/template_266.html",
    "/v/v/template_266.html",
    "v/template_266.html",
)


def _expect_from_local(ws: str) -> str:
    path = os.path.join(ws, "template_266.html")
    with open(path, encoding="utf-8", errors="replace") as f:
        raw = f.read()
    m = re.search(r'name="mc-deploy-verify"\s+content="([^"]+)"', raw)
    return m.group(1) if m else ""


def _normalize_secret_template_path() -> str:
    secret = os.environ.get("SFTP_TEMPLATE_REMOTE", "").strip()
    if secret and not secret.startswith("/"):
        secret = "/" + secret
    if secret == "/v/v/template_266.html":
        secret = "/v/template_266.html"
    return secret


def _download_marker(sftp, remote: str) -> str | None:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
    tmp.close()
    local = tmp.name
    try:
        sftp.get(remote, local)
    except Exception:  # noqa: BLE001
        try:
            os.unlink(local)
        except OSError:
            pass
        return None
    try:
        with open(local, encoding="utf-8", errors="replace") as f:
            m = re.search(
                r'name="mc-deploy-verify"\s+content="([^"]+)"',
                f.read(),
            )
        return m.group(1) if m else ""
    finally:
        try:
            os.unlink(local)
        except OSError:
            pass


def _fallback_paths() -> list[str]:
    secret = _normalize_secret_template_path()
    raw = [secret, "/template_266.html", "template_266.html"]
    seen: set[str] = set(_CANONICAL_V_PATHS)
    out: list[str] = []
    for p in raw:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _browser_like_headers(url: str) -> dict[str, str]:
    """Many storefronts return 403 to non-browser User-Agents (WAF / bot rules)."""
    try:
        from urllib.parse import urlparse

        origin = f"{urlparse(url).scheme}://{urlparse(url).netloc}/"
    except Exception:
        origin = "https://www.mccabestheaterandliving.com/"
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/avif,image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": origin,
    }


def _http_marker(expect: str) -> tuple[bool, str, str, str | None]:
    """
    Return (ok, detail, url_used, failure_kind).

    failure_kind: None (success), 'skipped', 'http' (could not fetch/parse page),
    'mismatch' (fetched but wrong marker).
    """
    if os.environ.get("SKIP_HTTP_TEMPLATE_VERIFY", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return True, "skipped", "", "skipped"

    default_url = "https://www.mccabestheaterandliving.com/v/template_266.html"
    url = (os.environ.get("VERIFY_HTTP_TEMPLATE_URL") or "").strip() or default_url
    if not url:
        return True, "no_url", "", None

    sep = "&" if "?" in url else "?"
    full = f"{url}{sep}_mcv={int(time.time())}"
    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        full,
        headers=_browser_like_headers(url),
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return (
            False,
            f"HTTP {exc.code} (live URL blocked or denied this request)",
            url,
            "http",
        )
    except Exception as exc:  # noqa: BLE001
        return False, str(exc), url, "http"

    m = re.search(r'name="mc-deploy-verify"\s+content="([^"]+)"', raw)
    got = m.group(1) if m else ""
    if got == expect:
        return True, got, url, None
    return False, got or "(no meta tag)", url, "mismatch"


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)

    expect = _expect_from_local(ws)
    if not expect:
        print("::notice::No mc-deploy-verify in template; skipping remote verify.")
        return 0

    host = (
        os.environ.get("SFTP_HOST", "").strip()
        or os.environ.get("SECRET_SFTP_HOST", "").strip()
        or os.environ.get("SECRET_FTP_HOST", "").strip()
    )
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("SECRET_SFTP_PORT") or "2222")
    user = os.environ.get("SFTP_USER", "")
    password = os.environ.get("SFTP_PASS", "")

    if not host or not user or not password:
        print("::error::Missing SFTP env (host, user, pass) for verify step.", file=sys.stderr)
        return 1

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::SFTP verify connect failed: {exc}", file=sys.stderr)
        return 1

    sftp_any_match: str | None = None

    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for remote in _CANONICAL_V_PATHS:
                got = _download_marker(sftp, remote)
                if got is None:
                    print(f"::notice::SFTP no file at {remote!r} (skipped).", flush=True)
                    continue
                if got == expect:
                    print(
                        f"::notice::SFTP /v/ path OK: {remote!r} mc-deploy-verify={expect}",
                        flush=True,
                    )
                    sftp_any_match = remote
                    break
                print(
                    "::error::SFTP live-path file "
                    f"{remote!r} has mc-deploy-verify={got!r}, expected {expect!r}.",
                    file=sys.stderr,
                )
                return 1

            if sftp_any_match is None:
                print(
                    "::warning::Could not read any /v/... template via SFTP; "
                    "trying SFTP root fallbacks (HTTP check will still run).",
                    flush=True,
                )
                for remote in _fallback_paths():
                    got = _download_marker(sftp, remote)
                    if got is None:
                        print(f"::warning::SFTP get skip {remote!r}", flush=True)
                        continue
                    if got == expect:
                        print(
                            f"::notice::SFTP fallback OK: {remote!r} mc-deploy-verify={expect}",
                            flush=True,
                        )
                        sftp_any_match = remote
                        break
                    print(
                        f"::warning::SFTP {remote!r} has mc-deploy-verify={got!r}, "
                        f"expected {expect!r}.",
                        flush=True,
                    )
        finally:
            try:
                sftp.close()
            except Exception:
                pass
    finally:
        transport.close()

    if sftp_any_match is None:
        print(
            "::error::SFTP: no path returned mc-deploy-verify matching "
            f"{expect!r}. Upload likely failed.",
            file=sys.stderr,
        )
        return 1

    http_ok, http_detail, http_url, http_fail_kind = _http_marker(expect)
    if not http_ok:
        if http_fail_kind == "http":
            print(
                "::error::Could not verify live template over HTTP. "
                f"{http_detail}. URL={http_url!r}. "
                "SFTP may still be correct; your host may block datacenter IPs. "
                "Try VERIFY_HTTP_TEMPLATE_URL to the exact storefront URL, or "
                "SKIP_HTTP_TEMPLATE_VERIFY=true only as a temporary bypass.",
                file=sys.stderr,
            )
        else:
            print(
                "::error::Live template URL does not match Git yet. "
                f"URL={http_url!r} saw mc-deploy-verify={http_detail!r}, expected {expect!r}. "
                "SFTP updated a file, but the public page (or cache) is still old. "
                "Set VERIFY_HTTP_TEMPLATE_URL if your live URL differs. "
                "Or set SKIP_HTTP_TEMPLATE_VERIFY=true only as a temporary bypass.",
                file=sys.stderr,
            )
        return 1

    if http_detail != "skipped":
        print(
            f"::notice::HTTP template OK: {http_url!r} mc-deploy-verify={expect}",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
