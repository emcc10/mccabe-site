#!/usr/bin/env python3
"""SFTP gate: canonical /v/vspfiles/js/* must match repo (MD5 + size)."""
from __future__ import annotations
import hashlib, os, sys
CANONICAL = {
    "vspfiles/js/mc-pdp-auth-cta-form.js": ("/v/vspfiles/js/mc-pdp-auth-cta-form.js", "MC_PDP_AUTH_ONCE_20260727014alex2"),
    "vspfiles/js/mc-pdp-auth-cta-form-impl.js": ("/v/vspfiles/js/mc-pdp-auth-cta-form-impl.js", "mcEnsurePdpPriceStack"),
    "vspfiles/js/mc-pdp-price-stack.js": ("/v/vspfiles/js/mc-pdp-price-stack.js", "fixSsBrokenPhotosEarly"),
    "vspfiles/js/mc-ss-pdp-layout.js": ("/v/vspfiles/js/mc-ss-pdp-layout.js", "MC_SS_PDP_LAYOUT_20260726audit1"),
    "vspfiles/js/mc-pdp-alt-view-row.js": ("/v/vspfiles/js/mc-pdp-alt-view-row.js", "MC_ALT_VIEW_ROW_20260726audit1"),
}
def md5_hex(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()
def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))
    host = os.environ.get("SFTP_HOST", "").strip() or os.environ.get("FTP_SERVER", "").strip()
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("FTP_PORT") or "2222")
    user = os.environ.get("SFTP_USER", "") or os.environ.get("FTP_USERNAME", "")
    password = os.environ.get("SFTP_PASS", "") or os.environ.get("FTP_PASSWORD", "")
    if not host or not user or not password:
        print("::error::Missing SFTP credentials for mc-pdp JS verify", file=sys.stderr); return 1
    from verify_template_sftp import connect_paramiko_transport
    import paramiko
    try:
        transport = connect_paramiko_transport(host, port, user, password)
    except Exception as exc:
        print(f"::error::SFTP connect failed: {exc}", file=sys.stderr); return 1
    all_ok=True; checked=0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for local,(remote,needle) in CANONICAL.items():
                if not os.path.isfile(local):
                    print(f"::warning::SKIP verify {local!r}", flush=True); continue
                checked += 1
                local_data=open(local,"rb").read()
                if needle not in local_data.decode("utf-8","replace"):
                    print(f"::error::Local {local} missing {needle}", file=sys.stderr); all_ok=False; continue
                try:
                    remote_data=sftp.open(remote,"rb").read()
                except OSError as exc:
                    print(f"::error::SFTP cannot read {remote!r}: {exc}", file=sys.stderr); all_ok=False; continue
                ok = md5_hex(remote_data)==md5_hex(local_data) and needle in remote_data.decode("utf-8","replace") and len(remote_data)==len(local_data)
                print(f"::notice::CHECK {remote!r} size={len(remote_data)} want={len(local_data)} md5={'yes' if md5_hex(remote_data)==md5_hex(local_data) else 'no'} needle={'yes' if needle in remote_data.decode('utf-8','replace') else 'no'}", flush=True)
                if ok: print(f"::notice::SFTP_CANONICAL_OK {remote}", flush=True)
                else:
                    print(f"::error::SFTP stale/wrong at {remote!r}", file=sys.stderr); all_ok=False
        finally:
            sftp.close()
    finally:
        transport.close()
    if checked==0: return 0
    if all_ok:
        print("::notice::MC_PDP_JS_SFTP_CANONICAL_OK", flush=True); return 0
    return 1
if __name__ == "__main__":
    sys.exit(main())
