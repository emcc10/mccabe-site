# -*- coding: utf-8 -*-
from __future__ import annotations
import base64, os, sys
from pathlib import Path
from xml.etree import ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from verify_template_sftp import connect_paramiko_transport

FILES = [
    "vspfiles/js/mc-pdp-alt-view-row.js",
    "vspfiles/js/mc-pdp-auth-cta-form.js",
    "vspfiles/js/mc-bedroom-collection-section.js",
    "vspfiles/css/custom-safe.css",
    "template_266.html",
]

def load_filezilla_creds():
    root = ET.parse(str(Path.home() / "AppData/Roaming/FileZilla/sitemanager.xml")).getroot()
    for s in root.findall(".//Server"):
        if (s.findtext("Name") or "").strip() == "mccabe-site":
            host = (s.findtext("Host") or "").strip()
            port = int((s.findtext("Port") or "22").strip() or "22")
            user = (s.findtext("User") or "").strip()
            pw = base64.b64decode((s.find("Pass").text or "").encode()).decode("utf-8")
            return host, port, user, pw
    raise SystemExit("FileZilla site mccabe-site not found")

def remotes_for(local: str):
    rel = local.replace("\\", "/")
    if rel == "template_266.html":
        return ["v/template_266.html", "template_266.html"]
    return ["/v/" + rel, rel]

def main():
    os.chdir(ROOT)
    host, port, user, pw = load_filezilla_creds()
    print(f"Connecting {host}:{port} as {user}", flush=True)
    import paramiko
    transport = connect_paramiko_transport(host, port, user, pw)
    ok = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        assert sftp is not None
        for local in FILES:
            path = ROOT / local
            if not path.is_file():
                print("SKIP missing " + local, flush=True)
                continue
            data = path.read_bytes()
            for remote in remotes_for(local):
                try:
                    try:
                        sftp.remove(remote)
                    except OSError:
                        pass
                    tmp = remote + ".deploy-tmp"
                    try:
                        sftp.remove(tmp)
                    except OSError:
                        pass
                    with sftp.open(tmp, "wb") as handle:
                        handle.write(data)
                    try:
                        sftp.rename(tmp, remote)
                    except OSError:
                        sftp.put(str(path), remote, confirm=False)
                    print(f"PUTOK {local} -> {remote} ({len(data)} bytes)", flush=True)
                    ok += 1
                except Exception as exc:
                    print(f"PUTFAIL {local} -> {remote}: {exc}", flush=True)
        sftp.close()
    finally:
        transport.close()
    print(f"Done puts={ok}", flush=True)
    return 0 if ok else 1

if __name__ == "__main__":
    raise SystemExit(main())
