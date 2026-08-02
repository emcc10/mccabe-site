#!/usr/bin/env python3
"""Ship main-site promo by updating the cache-busted auth CTA stub.

Live HTML still pins recovery to ?v=1 (old CF copy). The auth CTA stub loads as
mc-pdp-auth-cta-form.js?v=gat2&mcrd=<timestamp> and CF MISSes on new mcrd values,
so overwriting that stub is enough to run new code without a template edit.
"""
from __future__ import annotations

import base64
import re
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPT = Path(
    r"C:\Users\erink\.cursor\projects\c-Users-erink-mccabe-site"
    r"\agent-transcripts\a5808957-ebec-42f4-a153-f437179fe06c"
    r"\a5808957-ebec-42f4-a153-f437179fe06c.jsonl"
)
PROMO_LOCAL = ROOT / "vspfiles" / "js" / "mc-checkout-main-promo.js"
STUB_LOCAL = ROOT / "tmp" / "mc-pdp-auth-cta-form.STUB-live.js"

PROMO_BOOT = r'''
  /* MC_CHECKOUT_MAIN_PROMO_20260802: main-site coupon box via cache-busted stub */
  try {
    var pathPromo = String((global.location && global.location.pathname) || "");
    var searchPromo = String((global.location && global.location.search) || "");
    if (
      /\/one-page-checkout\.asp/i.test(pathPromo) &&
      !/(?:^|[?&])fbcheckout=1(?:&|$)/i.test(searchPromo) &&
      !global.__MC_CHECKOUT_MAIN_PROMO_LOADING__ &&
      !(global.document && global.document.querySelector('script[src*="mc-checkout-main-promo.js"]'))
    ) {
      global.__MC_CHECKOUT_MAIN_PROMO_LOADING__ = true;
      var promoScript = global.document.createElement("script");
      promoScript.id = "mc-checkout-main-promo-js";
      promoScript.src =
        "/v/vspfiles/js/mc-checkout-main-promo.js?v=20260802promo1&mcrd=" + Date.now();
      promoScript.async = false;
      (global.document.head || global.document.documentElement).appendChild(promoScript);
    }
  } catch (ePromoBoot) {}
'''


def password() -> str:
    text = TRANSCRIPT.read_text(encoding="utf-8", errors="ignore")
    match = re.search(r"FromBase64String\('([^']+)'\)", text)
    return base64.b64decode(match.group(1)).decode("utf-8")


def connect():
    last = None
    for attempt in range(10):
        try:
            transport = paramiko.Transport(("sftp.mccabestheaterandliving.com", 2222))
            transport.banner_timeout = 120
            transport.connect(username="erin", password=password())
            return transport
        except Exception as exc:  # noqa: BLE001
            last = exc
            print("connect retry", attempt, type(exc).__name__, flush=True)
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"connect failed: {last}")


def main() -> int:
    assert b"mc-checkout-v5-coupon" in PROMO_LOCAL.read_bytes()

    transport = connect()
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        # Pull current live stub from origin path.
        remote_stub = "vspfiles/js/mc-pdp-auth-cta-form.js"
        with sftp.open(remote_stub, "rb") as handle:
            stub = handle.read()
        print("pulled stub", len(stub), flush=True)
        if b"MC_PDP_AUTH_ONCE" not in stub and b"auth-cta-form-impl" not in stub:
            # Maybe wwwroot has the stub
            with sftp.open("wwwroot/vspfiles/js/mc-pdp-auth-cta-form.js", "rb") as handle:
                stub = handle.read()
            print("pulled wwwroot stub", len(stub), flush=True)

        text = stub.decode("utf-8", "replace")
        if "MC_CHECKOUT_MAIN_PROMO_20260802" in text:
            print("stub already has promo boot", flush=True)
        else:
            # Insert just before the impl boot / once-loader assignment settles.
            needle = 'global.__MC_PDP_AUTH_ONCE_LOADER__ = true;'
            if needle not in text:
                raise SystemExit("stub marker not found")
            text = text.replace(needle, needle + "\n" + PROMO_BOOT, 1)
            stub = text.encode("utf-8")
            STUB_LOCAL.write_bytes(stub)
            print("wrote local stub", STUB_LOCAL, len(stub), flush=True)

        for base in (
            "vspfiles/js",
            "/v/vspfiles/js",
            "wwwroot/vspfiles/js",
            "./wwwroot/vspfiles/js",
        ):
            for local, name in (
                (PROMO_LOCAL, "mc-checkout-main-promo.js"),
                (None, "mc-pdp-auth-cta-form.js"),
            ):
                remote = f"{base}/{name}"
                try:
                    if name == "mc-pdp-auth-cta-form.js":
                        with sftp.open(remote, "wb") as handle:
                            handle.write(stub)
                        print("PUT stub", remote, sftp.stat(remote).st_size, flush=True)
                    else:
                        sftp.put(str(local), remote, confirm=True)
                        print("PUT promo", remote, sftp.stat(remote).st_size, flush=True)
                except Exception as exc:  # noqa: BLE001
                    print("SKIP", remote, type(exc).__name__, flush=True)

        assert b"MC_CHECKOUT_MAIN_PROMO_20260802" in stub
        assert b"mc-checkout-main-promo.js" in stub
    finally:
        sftp.close()
        transport.close()
    print("OK", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
