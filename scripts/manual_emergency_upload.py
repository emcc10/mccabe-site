#!/usr/bin/env python3
"""Upload deploy/manual-sftp-restore-20260625 to every canonical Volusion SFTP path."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "deploy" / "manual-sftp-restore-20260625"

CHUNKED_OVER_CAP = frozenset(
    {
        "vspfiles/templates/266/js/min/template.min.js",
    }
)

VOLUSION_CAP = 131072

FILES = (
    "vspfiles/templates/266/js/min/template.min.js",
    "vspfiles/js/mc-plp-enforcer.js",
    "vspfiles/templates/266/css/mccabe-overrides.css",
    "vspfiles/js/mc-unified-pdp-layout.js",
    "vspfiles/js/mc-pdp-price-stack.js",
    "vspfiles/js/sectional-configs.js",
    "vspfiles/js/mc-sectional-pdp-emergency.js",
    "vspfiles/js/mtl-sectional-renderer.js",
    "vspfiles/css/mc-live-patch.css",
    "vspfiles/css/mc-plp-body-last.css",
    "vspfiles/js/mc-cart-checkout-fix.js",
    "vspfiles/js/mc-windsor-hero-fix.js",
    "vspfiles/js/mc-bedroom-collection-section.js",
    "vspfiles/js/mc-pdp-auth-cta-fix.js",
    "vspfiles/css/custom-safe.css",
)


def _remotes(rel: str) -> list[str]:
    sub = rel.split("vspfiles/", 1)[-1]
    paths = [
        f"/v/vspfiles/{sub}",
        f"/vspfiles/{sub}",
        f"/mccabestheaterandliving.com/v/vspfiles/{sub}",
        f"/v/{rel}",
        rel,
        f"/{rel}",
    ]
    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _upload_chunked(sftp, local: str, remote: str, chunk_size: int = 16384) -> bool:
    want = os.path.getsize(local)
    _ensure_dir(sftp, remote)
    try:
        try:
            sftp.remove(remote)
        except OSError:
            pass
        with open(local, "rb") as src, sftp.open(remote, "wb") as dst:
            dst.set_pipelined(True)
            while True:
                buf = src.read(chunk_size)
                if not buf:
                    break
                dst.write(buf)
        got = sftp.stat(remote).st_size
    except OSError as exc:
        print(f"SKIP chunked {remote}: {exc}")
        return False
    if got == want:
        print(f"OK chunked {local} -> {remote} ({want} bytes)")
        return True
    print(f"SIZE_MISMATCH chunked {remote} want={want} got={got}")
    return False


def _ensure_dir(sftp, remote: str) -> None:
    directory = remote.rsplit("/", 1)[0]
    if not directory:
        return
    cur = ""
    for part in [p for p in directory.split("/") if p]:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except OSError:
            try:
                sftp.mkdir(cur)
            except OSError:
                pass


def main() -> int:
    host = (os.environ.get("SFTP_HOST") or os.environ.get("FTP_SERVER") or "").strip()
    user = (os.environ.get("SFTP_USER") or os.environ.get("FTP_USERNAME") or "").strip()
    password = (os.environ.get("SFTP_PASS") or os.environ.get("FTP_PASSWORD") or "").strip()
    port = int((os.environ.get("SFTP_PORT") or os.environ.get("FTP_PORT") or "2222").strip())

    if not host or not user or not password:
        print(
            "Set FTP_SERVER, FTP_USERNAME, FTP_PASSWORD (port 2222) then re-run.",
            file=sys.stderr,
        )
        return 1

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        try:
            print(f"SFTP getcwd={sftp.getcwd()!r}")
        except Exception as exc:  # noqa: BLE001
            print(f"SFTP getcwd: {exc}")

        fail = 0
        for rel in FILES:
            local = BUNDLE / rel.replace("/", os.sep)
            if not local.is_file():
                print(f"::error::missing local {local}")
                fail += 1
                continue
            want = local.stat().st_size
            ok_path = None
            use_chunked = rel.replace("\\", "/") in CHUNKED_OVER_CAP and want > VOLUSION_CAP
            for remote in _remotes(rel):
                try:
                    if use_chunked:
                        if _upload_chunked(sftp, str(local), remote):
                            ok_path = remote
                            break
                        continue
                    _ensure_dir(sftp, remote)
                    sftp.put(str(local), remote, confirm=False)
                    st = sftp.stat(remote)
                    if st.st_size == want:
                        print(f"OK {rel} -> {remote} ({want} bytes)")
                        ok_path = remote
                        break
                    print(f"WARN size mismatch {remote}: {st.st_size} != {want}")
                except Exception as exc:  # noqa: BLE001
                    print(f"SKIP {remote}: {exc}")
            if not ok_path:
                print(f"::error::FAILED {rel}")
                fail += 1

        # Verify HTTP-served paths exist on SFTP
        for check in (
            "/v/vspfiles/js/mc-plp-enforcer.js",
            "/v/vspfiles/templates/266/css/mccabe-overrides.css",
            "/mccabestheaterandliving.com/v/vspfiles/js/mc-plp-enforcer.js",
            "/mccabestheaterandliving.com/v/vspfiles/templates/266/css/mccabe-overrides.css",
        ):
            try:
                st = sftp.stat(check)
                print(f"VERIFY stat {check!r} size={st.st_size}")
            except Exception as exc:  # noqa: BLE001
                print(f"VERIFY missing {check!r}: {exc}")

        photo_dir = BUNDLE / "vspfiles" / "photos"
        if photo_dir.is_dir():
            for photo in sorted(photo_dir.glob("SAR-*-1.jpg")):
                rel = f"vspfiles/photos/{photo.name}"
                want = photo.stat().st_size
                ok_path = None
                for remote in _remotes(rel):
                    try:
                        _ensure_dir(sftp, remote)
                        sftp.put(str(photo), remote, confirm=False)
                        st = sftp.stat(remote)
                        if st.st_size == want:
                            ok_path = remote
                            break
                    except Exception as exc:  # noqa: BLE001
                        print(f"SKIP {remote}: {exc}")
                if ok_path:
                    print(f"OK {rel} -> {ok_path} ({want} bytes)")
                else:
                    print(f"::error::FAILED {rel}")
                    fail += 1

        return 1 if fail else 0
    finally:
        sftp.close()
        transport.close()


if __name__ == "__main__":
    sys.exit(main())
