#!/usr/bin/env python3
"""Disabled: baked-HTML enforcer hotpatching caused PDP freeze loops.

Kept as a no-op so deploy.yml / deploy-volusion.sh can still invoke it safely.
Restore path = pre-freeze storefront (PR #30 / f05a4f26).
"""
from __future__ import annotations
import sys

def main() -> int:
    print("::notice::patch_baked_html_enforcer disabled (revert to working storefront)", flush=True)
    return 0

if __name__ == "__main__":
    sys.exit(main())
